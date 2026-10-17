// Typed wrappers over lib/graph/queries/*.cypher. Every result carries the Cypher it ran
// (`cypher: {name, text}[]`) for the UI's "Cypher used" toggle. Dates are epoch seconds; pass `now`.
import { readFileSync } from "node:fs";
import path from "node:path";
import { z } from "zod";
import { query, roQuery, type Graph } from "./client";
import {
  Artifact, BottleneckRow, Change, Conflict, Decision, Person, WhoKnowsRow,
  type EdgeType, type InboxItem, type RippleResult, type Source,
} from "../schemas";

const DIR = path.join(process.cwd(), "lib/graph/queries");
const cache = new Map<string, string>();
export class NotFound extends Error {}
export type Cypher = { name: string; text: string };
export type Result<T> = { data: T; cypher: Cypher[] };

export function load(name: string): Cypher {
  let text = cache.get(name);
  if (text === undefined) cache.set(name, (text = readFileSync(path.join(DIR, `${name}.cypher`), "utf8")));
  return { name, text };
}
async function run<T>(g: Graph, name: string, params: Record<string, unknown>, schema: z.ZodType<T>, text?: string, write = false) {
  const c = text ? { name, text } : load(name);
  const rows = await (write ? query : roQuery)(g, c.text, params);
  return { rows: z.array(schema).parse(rows), c };
}

const n = z.coerce.number();
const DAY = 86400;

// ---------- gap ----------
const GapRow = z.object({ team: z.string(), name: z.string(), involved: z.boolean(), acked: z.boolean() });
type GapRow = z.infer<typeof GapRow>;

/** Affected teams with neither INVOLVED_IN nor ACKED on the decision. */
export async function gap(g: Graph, decisionId: string, affected: string[]): Promise<Result<string[]> & { teams: GapRow[] }> {
  const { rows, c } = await run(g, "gap", { id: decisionId, affected }, GapRow);
  return { data: rows.filter((r) => !r.involved && !r.acked).map((r) => r.team), teams: rows, cypher: [c] };
}

// ---------- conflicts ----------
const Detected = z.object({
  systemId: z.string(),
  contractIds: z.array(z.string()),
  guaranteeSources: z.array(z.object({ artifactId: z.string().nullable(), quote: z.string().nullable() })),
  sunsetSrc: z.string().nullable(),
  sunsetQuote: z.string().nullable(),
});
const ConflictRow = z.object({
  id: z.string(), kind: z.literal("sunset_vs_guarantee"), severity: z.enum(["low", "medium", "high"]),
  status: z.enum(["open", "resolved"]), decisionId: z.string(), contractIds: z.array(z.string()),
  detectedAt: n, sources: z.string(),
});

/** Read the stored Conflict nodes for a decision. Never writes. */
async function listConflicts(g: Graph, decisionId: string): Promise<Result<Conflict[]>> {
  const list = await run(g, "conflicts-list", { id: decisionId }, ConflictRow);
  return { data: list.rows.map((r) => Conflict.parse({ ...r, sources: JSON.parse(r.sources) })), cypher: [list.c] };
}

/**
 * Detect sunset-vs-guarantee conflicts, MERGE them as Conflict nodes, resolve the ones no longer true.
 * The only conflict writer: call it where state changes (seed, change-sunset), never on a read path.
 * Covers every decision unless `decisionId` is given.
 */
export async function detectConflicts(g: Graph, now: number, decisionId?: string): Promise<Result<Conflict[]>> {
  const ids = decisionId ? [decisionId] : (await decisions(g)).data.map((d) => d.id);
  const merge = load("conflicts-merge");
  const data: Conflict[] = [];
  const cypher: Cypher[] = [];
  for (const id of ids) {
    const det = await run(g, "conflicts-detect", { id }, Detected);
    const keep: string[] = [];
    for (const r of det.rows) {
      const cid = `conf-${id}-${r.systemId}`;
      keep.push(cid);
      const sources: Source[] = [
        ...(r.sunsetSrc && r.sunsetQuote ? [{ artifactId: r.sunsetSrc, quote: r.sunsetQuote }] : []),
        ...r.guaranteeSources.flatMap((s) => (s.artifactId && s.quote ? [{ artifactId: s.artifactId, quote: s.quote }] : [])),
      ];
      await query(g, merge.text, { cid, id, now, contractIds: r.contractIds, sources: JSON.stringify(sources) });
    }
    const resolve = await run(g, "conflicts-resolve", { id, keep }, z.object({ n }), undefined, true);
    const list = await listConflicts(g, id);
    data.push(...list.data);
    cypher.push(det.c, merge, resolve.c, ...list.cypher);
  }
  return { data, cypher };
}

// ---------- ripple ----------
const RippleRow = z.object({
  kind: z.enum(["system", "ticket", "deal", "contract", "customer", "team"]),
  ref: z.string(), label: z.string(), sys: z.string().nullable(), hop: n,
  rel: z.string(), team: z.string().nullable(), reason: z.string().nullable(),
  src: z.string().nullable(), quote: z.string().nullable(), amount: n,
});
const DecisionRow = Decision.extend({
  src: z.string().nullable(), quote: z.string().nullable(), decidedAt: n,
});

const Depth = z.number().int().min(1).max(4);

/** `depth` = systems hops from the sunset system (1 = the system itself, 3 = default, 4 = max). */
export async function ripple(g: Graph, decisionId: string, now: number, depth = 3): Promise<RippleResult> {
  const hops = Depth.parse(depth) - 1; // Cypher can't parametrize var-length bounds; validated int, then substituted
  const text = load("ripple").text.replaceAll("DEPENDS_ON*0..2", `DEPENDS_ON*0..${hops}`);
  const dec = await run(g, "decision", { id: decisionId }, DecisionRow);
  if (!dec.rows[0]) throw new NotFound(`unknown decision ${decisionId}`);
  const { src, quote, ...decision } = dec.rows[0];
  const fallback: Source = { artifactId: src ?? decisionId, quote: quote ?? decision.title };
  const rp = await run(g, "ripple", { id: decisionId, now }, RippleRow, text);

  const nodes = new Map<string, RippleResult["nodes"][number]>([
    [decisionId, { id: decisionId, label: decision.title, kind: "decision", hop: 0 }],
  ]);
  const edges = new Map<string, RippleResult["edges"][number]>();
  const addEdge = (from: string, to: string, type: string) => edges.set(`${from}|${to}|${type}`, { from, to, type: type as EdgeType });
  const whyBy = new Map<string, Map<string, { reason: string; ref: string; source: Source; n: number }>>();

  for (const r of rp.rows) {
    if (r.kind === "team") {
      const t = r.team!;
      const byRel = whyBy.get(t) ?? new Map();
      const w = byRel.get(r.rel);
      if (w) w.n++;
      else byRel.set(r.rel, { reason: r.reason!, ref: r.ref, n: 1, source: r.src && r.quote ? { artifactId: r.src, quote: r.quote } : fallback });
      whyBy.set(t, byRel);
      addEdge(...(r.rel === "OWNS" || r.rel === "CARES_ABOUT" ? [t, r.ref] : [r.ref, t]) as [string, string], r.rel);
      continue;
    }
    const prev = nodes.get(r.ref);
    if (!prev || r.hop < prev.hop) nodes.set(r.ref, { id: r.ref, label: r.label, kind: r.kind, hop: r.hop });
    if (r.kind === "system") {
      if (r.hop === 1) addEdge(decisionId, r.ref, "SUNSETS");
      else if (r.sys) addEdge(r.ref, r.sys, "DEPENDS_ON");
    } else if (r.sys) addEdge(r.ref, r.sys, r.rel);
  }

  const maxHop = Math.max(...[...nodes.values()].map((x) => x.hop));
  const teamIds = [...whyBy.keys()].sort();
  const gp = await gap(g, decisionId, teamIds);
  const names = new Map(gp.teams.map((t) => [t.team, t.name]));
  for (const t of teamIds) nodes.set(t, { id: t, label: names.get(t) ?? t, kind: "team", hop: maxHop + 1 });

  const cf = await listConflicts(g, decisionId);
  const open = cf.data.filter((c) => c.status === "open");
  const contractIds = new Set(open.flatMap((c) => c.contractIds));
  const rows = (k: string) => new Map(rp.rows.filter((r) => r.kind === k).map((r) => [r.ref, r]));

  return {
    decision,
    nodes: [...nodes.values()],
    edges: [...edges.values()],
    teams: gp.teams.sort((a, b) => a.team.localeCompare(b.team)).map((t) => ({
      teamId: t.team,
      why: [...whyBy.get(t.team)!.values()].map((w) => ({ reason: w.n > 1 ? `${w.reason} (${w.n})` : w.reason, ref: w.ref, source: w.source })),
      involved: t.involved,
      acked: t.acked,
    })),
    gap: gp.data,
    conflicts: open,
    counts: {
      teamsAffected: teamIds.length,
      notTold: gp.data.length,
      conflicts: open.length,
      customers: rows("customer").size,
      tickets: rows("ticket").size,
      deals: rows("deal").size,
      contracts: rows("contract").size,
      arrAtRisk: [...rows("contract").values()].filter((r) => contractIds.has(r.ref)).reduce((s, r) => s + r.amount, 0),
    },
    cypher: [dec.c, rp.c, ...gp.cypher, ...cf.cypher],
  };
}

// ---------- who knows ----------
const WhoRow = z.object({
  personId: z.string(), role: z.enum(["authored", "reviewed", "handled"]), id: z.string(), ts: n.nullable(),
});
export type WhoKnows = WhoKnowsRow & { evidence: string[]; score: number };
const WEIGHT = { authored: 3, reviewed: 2, handled: 1 } as const;

/** Top 5 active people by authored (3) + reviewed (2) + handled (1) evidence about the system. */
export async function whoKnows(g: Graph, systemId: string): Promise<Result<WhoKnows[]>> {
  const { rows, c } = await run(g, "who-knows", { id: systemId }, WhoRow);
  const by = new Map<string, WhoKnows>();
  for (const r of rows) {
    const w = by.get(r.personId) ?? { personId: r.personId, systemId, authored: 0, reviewed: 0, handled: 0, lastSeen: 0, evidence: [], score: 0 };
    w[r.role]++;
    w.score += WEIGHT[r.role];
    w.lastSeen = Math.max(w.lastSeen, r.ts ?? 0);
    w.evidence.push(r.id);
    by.set(r.personId, w);
  }
  const data = [...by.values()].sort((x, y) => y.score - x.score || x.personId.localeCompare(y.personId)).slice(0, 5);
  return { data, cypher: [c] };
}

// ---------- diff ----------
const DiffRow = z.object({
  from: z.string(), to: z.string(), type: z.string(), validFrom: n, validTo: n.nullable(),
  src: z.string().nullable(), quote: z.string().nullable(),
});

/** Edges added (valid_from > since) or ended (valid_to > since). */
export async function diff(g: Graph, since: number): Promise<Result<Change[]>> {
  const { rows, c } = await run(g, "diff", { since }, DiffRow);
  const data = rows.flatMap((r) => {
    const edge = {
      from: r.from, to: r.to, type: r.type as EdgeType, validFrom: r.validFrom, validTo: r.validTo,
      ...(r.src && r.quote ? { src: { artifactId: r.src, quote: r.quote } } : {}),
    };
    const out: Change[] = [];
    if (r.validFrom > since) out.push({ kind: "added", at: r.validFrom, edge });
    if (r.validTo !== null && r.validTo > since) out.push({ kind: "ended", at: r.validTo, edge });
    return out;
  }).sort((a, b) => b.at - a.at);
  return { data: z.array(Change).parse(data), cypher: [c] };
}

// ---------- bottleneck ----------
const BnRow = z.object({
  blockerTeamId: z.string(), openRequests: n, totalWaitSecs: n, oldestSince: n, waitingTeamIds: z.array(z.string()),
});

export async function bottleneck(g: Graph, now: number): Promise<Result<BottleneckRow[]>> {
  const { rows, c } = await run(g, "bottleneck", { now }, BnRow);
  const data = rows.map((r) => BottleneckRow.parse({
    blockerTeamId: r.blockerTeamId, openRequests: r.openRequests,
    totalWaitDays: Math.floor(r.totalWaitSecs / DAY), oldestDays: Math.floor((now - r.oldestSince) / DAY),
    waitingTeamIds: r.waitingTeamIds.sort(),
  }));
  return { data, cypher: [c] };
}

// ---------- search ----------
const Hit = z.object({ id: z.string(), kind: z.string(), title: z.string(), score: n });

export async function search(g: Graph, text: string): Promise<Result<z.infer<typeof Hit>[]>> {
  const { rows, c } = await run(g, "search", { text }, Hit);
  return { data: rows, cypher: [c] };
}

/** Hybrid vector -> graph search. Needs Artifact.emb (pnpm embed + seed). */
export async function searchVector(g: Graph, vec: number[], k = 10) {
  const { rows, c } = await run(g, "search-vector", { vec, k }, Hit.extend({ systemIds: z.array(z.string()) }));
  return { data: rows, cypher: [c] };
}

// ---------- why affected ----------
const PathRows = z.array(z.object({
  nodes: z.array(z.object({ id: z.string(), label: z.string(), name: z.string().nullable() })),
  rels: z.array(z.object({ type: z.string(), src: z.string().nullable(), quote: z.string().nullable() })),
}));
export type WhyPath = z.infer<typeof PathRows>[number];

/** Shortest path decision -> team over the ripple edges, else over any edge; null when unreachable. */
export async function whyAffected(g: Graph, decisionId: string, teamId: string): Promise<Result<WhyPath | null>> {
  const cypher: Cypher[] = [];
  for (const name of ["why-affected", "why-affected-any"]) {
    const c = load(name);
    cypher.push(c);
    const [path] = PathRows.parse(await roQuery(g, c.text, { id: decisionId, team: teamId }));
    if (path) return { data: path, cypher };
  }
  return { data: null, cypher };
}

// ---------- live change ----------
/** End the current SUNSETS edge and write a new one with `on = newOn`; re-checks conflicts. */
export async function changeSunset(g: Graph, decisionId: string, newOn: number, now: number): Promise<Result<Conflict[]>> {
  const c = load("change-sunset");
  await query(g, c.text, { id: decisionId, newOn, now });
  const cf = await detectConflicts(g, now, decisionId);
  return { data: cf.data, cypher: [c, ...cf.cypher] };
}

// ---------- lookups ----------
export async function decisions(g: Graph): Promise<Result<Decision[]>> {
  const { rows, c } = await run(g, "decisions", {}, Decision);
  return { data: rows, cypher: [c] };
}

export async function people(g: Graph): Promise<Result<Person[]>> {
  const { rows, c } = await run(g, "people", {}, Person);
  return { data: rows, cypher: [c] };
}

/** id -> display name for teams, people, systems, customers, decisions, deals and contracts. */
export async function names(g: Graph): Promise<Result<Record<string, string>>> {
  const { rows, c } = await run(g, "names", {}, z.object({ id: z.string(), name: z.string() }));
  return { data: Object.fromEntries(rows.map((r) => [r.id, r.name])), cypher: [c] };
}

export async function source(g: Graph, id: string): Promise<Result<Artifact>> {
  const { rows, c } = await run(g, "source", { id }, z.record(z.string(), z.unknown()));
  if (!rows[0]) throw new NotFound(`unknown artifact ${id}`);
  const clean = Object.fromEntries(Object.entries(rows[0]).filter(([, v]) => v !== null));
  return { data: Artifact.parse(clean), cypher: [c] };
}

// ---------- inbox ----------
const Who = z.object({ team: z.string(), decisions: z.array(z.string()) });
const ReviewRow = z.object({ id: z.string(), title: z.string(), at: n, fromId: z.string().nullable() });
const WaitRow = z.object({ id: z.string(), name: z.string(), at: n });

/**
 * brief: one per team the person's team has not told, for each decision it sunsets
 * review: tasks in review assigned to the person; waiting: teams with an open request on the person's team.
 */
export async function inbox(g: Graph, personId: string, now: number): Promise<Result<InboxItem[]>> {
  const who = await run(g, "inbox-person", { id: personId }, Who);
  if (!who.rows[0]) return { data: [], cypher: [who.c] };
  const { team, decisions: owned } = who.rows[0];
  const rv = await run(g, "inbox-reviews", { id: personId }, ReviewRow);
  const wt = await run(g, "inbox-waiting", { team }, WaitRow);
  const items: InboxItem[] = [];
  const cypher = [who.c, rv.c, wt.c];
  for (const d of owned) {
    const r = await ripple(g, d, now);
    cypher.push(...r.cypher);
    for (const t of r.gap) {
      const name = r.nodes.find((x) => x.id === t)?.label ?? t;
      items.push({ id: `brief-${d}-${t}`, kind: "brief", title: `Brief: ${name} on "${r.decision.title}"`, at: r.decision.decidedAt, teamId: t, decisionId: d });
    }
  }
  for (const k of rv.rows)
    items.push({ id: `review-${k.id}`, kind: "review", title: k.title, at: k.at, taskId: k.id, from: k.fromId ?? personId });
  for (const w of wt.rows)
    items.push({ id: `wait-${w.id}-${team}`, kind: "waiting", title: `${w.name} is waiting on you`, at: w.at, waitingOn: w.id });
  return { data: items, cypher };
}
