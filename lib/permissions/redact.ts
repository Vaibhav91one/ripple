// Server-side redaction: share the topology, redact the details. Runs on every response body, agent tool output and
// MCP tool output BEFORE it is parsed, sent or shown to a model. Fails closed: a viewer with no teams sees no payload.
import { z } from "zod";
import { roQuery, type Graph } from "../graph/client";
import { load } from "../graph/queries";
import type { RestrictedSummary } from "../schemas/common";
import {
  ARR_OWNER, EDGE_OWNER, KIND_OWNER, LABEL_KIND, LEADERSHIP, RESTRICTED_QUOTE, RESTRICTED_TITLE, kindNoun,
  type RestrictedKind,
} from "./classify";

/** teamIds: whose payload the viewer owns. summaries: the capability to see counts and totals (never text or names). */
export type PermViewer = { teamIds?: readonly string[]; role?: string; summaries?: boolean };
export type Index = { ids: Map<string, { kind: Exclude<RestrictedKind, "source">; owner: string }>; artifacts: Map<string, string> };

/** Does the viewer own `team`'s payload? */
export const owns = (v: PermViewer | undefined, team: string) => !!v?.teamIds?.includes(team);
/** Summary level (counts, totals, ARR at risk), never clause, name or quote text: leadership and change owners. */
export const seesSummaries = (v: PermViewer | undefined) => !!v && (v.summaries === true || v.role === "change_owner" || owns(v, LEADERSHIP));

/** Which ids are restricted and which artifacts back restricted payload. Two cheap reads, per call (the graph changes). */
export async function loadIndex(g: Graph): Promise<Index> {
  const ids: Index["ids"] = new Map();
  for (const r of z.array(z.object({ id: z.string(), labels: z.array(z.string()) })).parse(await roQuery(g, load("restricted-ids").text))) {
    const kind = r.labels.map((l) => LABEL_KIND[l]).find(Boolean);
    if (kind) ids.set(r.id, { kind, owner: KIND_OWNER[kind] });
  }
  const artifacts: Index["artifacts"] = new Map();
  for (const r of z.array(z.object({ id: z.string(), type: z.string() })).parse(await roQuery(g, load("restricted-artifacts").text))) {
    const owner = EDGE_OWNER[r.type];
    if (owner && !artifacts.has(r.id)) artifacts.set(r.id, owner);
  }
  return { ids, artifacts };
}

const GONE = Symbol("gone");
const ID_KEYS = ["id", "dealId", "controlId", "findingId", "clauseId"] as const;
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/** Deep-walk `value`, hiding what `viewer` may not see. Returns the clean copy plus a summary of what was hidden. */
export function redact<T>(value: T, viewer: PermViewer | undefined, idx: Index): { value: T; restricted: RestrictedSummary[] } {
  const v = viewer ?? {};
  const lead = seesSummaries(v);
  const seen = new Map<string, { kind: RestrictedKind; owner: string; total: number }>(); // `${kind}:${id}` -> summary row
  const note = (kind: RestrictedKind, owner: string, id: string, usd = 0) => {
    if (!seen.has(`${kind}:${id}`)) seen.set(`${kind}:${id}`, { kind, owner, total: usd });
  };
  const usd = (o: Record<string, unknown>) => Number(o.value ?? o.amount ?? 0) || 0;

  const walk = (x: unknown): unknown => {
    if (Array.isArray(x)) return x.map(walk).filter((y) => y !== GONE);
    if (!isObj(x)) return x;

    // 1. a restricted node (contract, clause, deal, finding, control), by id
    for (const k of ID_KEYS) {
      const s = x[k];
      const r = typeof s === "string" ? idx.ids.get(s) : undefined;
      if (!r || owns(v, r.owner)) continue;
      note(r.kind, r.owner, s as string, usd(x));
      if (!("label" in x)) return GONE; // data row: drop it, the summary says how many
      // graph node: keep id/kind/hop so the topology is identical, hide the name
      const { name: _n, title: _t, text: _x, value: _v, amount: _a, ...rest } = x;
      void _n; void _t; void _x; void _v; void _a;
      return Object.fromEntries(Object.entries({ ...rest, label: kindNoun(r.kind) }).map(([k, y]) => [k, walk(y)]));
    }
    // 2. a source artifact backing restricted payload
    const artOwner = typeof x.id === "string" ? idx.artifacts.get(x.id) : undefined;
    if (artOwner && !owns(v, artOwner) && !("label" in x && "hop" in x)) {
      note("source", artOwner, x.id as string);
      const out: Record<string, unknown> = { ...x, restricted: artOwner };
      for (const f of ["title", "name"]) if (f in out) out[f] = RESTRICTED_TITLE;
      for (const f of ["text", "uri", "quote"]) if (f in out) out[f] = f === "quote" ? RESTRICTED_QUOTE : "";
      return out;
    }
    // 3. a cited quote
    const cited = typeof x.artifactId === "string" ? x.artifactId : typeof x.src === "string" ? x.src : undefined; // {artifactId, quote} or an edge's {src, quote}
    const own = cited && typeof x.quote === "string" ? idx.artifacts.get(cited) : undefined;
    if (own && !owns(v, own)) {
      note("source", own, cited!);
      return { ...x, quote: RESTRICTED_QUOTE, restricted: own };
    }

    const out: Record<string, unknown> = {};
    // a claim whose citation is restricted ({text, source}) may quote or name the restricted thing in its text
    const cite = x.source ?? x.src;
    const claimOwner = typeof x.text === "string" && isObj(cite) && typeof cite.artifactId === "string" ? idx.artifacts.get(cite.artifactId) : undefined;
    const hideText = !!claimOwner && !owns(v, claimOwner);
    for (const [k, y] of Object.entries(x)) {
      if (k === "text" && hideText) {
        out[k] = RESTRICTED_QUOTE;
        continue;
      }
      // id -> name maps: drop entries of restricted ids
      if (typeof y === "string") {
        const r = idx.ids.get(k);
        const a = idx.artifacts.get(k);
        if ((r && !owns(v, r.owner)) || (a && !owns(v, a))) continue;
      }
      if (k === "arr" && typeof y === "number") out[k] = owns(v, ARR_OWNER) ? y : null; // customer ARR: Sales only
      else if (k === "arrAtRisk" && typeof y === "number") out[k] = owns(v, ARR_OWNER) || lead ? y : null; // the total: leadership too
      else out[k] = walk(y);
    }
    return out;
  };

  const result = walk(value);
  const by = new Map<string, RestrictedSummary>();
  for (const s of seen.values()) {
    const key = `${s.kind}:${s.owner}`;
    const cur = by.get(key) ?? { kind: s.kind, owner: s.owner, count: 0 };
    cur.count++;
    if (lead && s.total) cur.total = (cur.total ?? 0) + s.total; // totals only at summary level
    by.set(key, cur);
  }
  return { value: result as T, restricted: [...by.values()].sort((a, b) => a.owner.localeCompare(b.owner) || a.kind.localeCompare(b.kind)) };
}

/** Redact a tool's output (rows + sources) and tell the model what was withheld, so it says "restricted to Legal" instead of guessing. */
export async function redactToolOut<O extends { rows: unknown[]; sources: unknown[] }>(
  g: Graph, viewer: PermViewer | undefined, out: O,
): Promise<O & { restricted?: RestrictedSummary[] }> {
  const r = redact({ rows: out.rows, sources: out.sources }, viewer, await loadIndex(g));
  return { ...out, rows: r.value.rows, sources: r.value.sources, ...(r.restricted.length ? { restricted: r.restricted } : {}) } as O & { restricted?: RestrictedSummary[] };
}
