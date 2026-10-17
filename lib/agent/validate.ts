// Answer validation (#211). After a run, every org entity the answer names must appear in this run's tool results,
// and an empty traversal can never be answered with impact or "safe". On failure the answer is rebuilt from the rows:
// a flatter, correct answer beats a confident, wrong one. Pure functions; only entityNames touches the graph.
import { roQuery, graphName, type Graph } from "../graph/client";
import { load } from "../graph/queries";
import type { Outcome } from "../schemas";

export type Row = Record<string, unknown>;
/** One tool call of a run: what was asked, what came back (already redacted), how long it took. */
export type Call = { tool: string; args: unknown; rows: Row[]; ms?: number; quotes?: string[] };
export type Names = Map<string, { name: string; kind: string }>;
export type Verdict = { ok: boolean; reasons: string[]; /** The text to show: the model's answer, or the deterministic one when rejected. */ answer: string; outcome: Outcome };

const TRAVERSALS = new Set(["ripple", "why_affected", "ripple_impact"]);
const CLAIM = /\b(affects?|affected|hits?|breaks?|breaking|impacts?|impacted|unaffected|safe|no impact)\b/i;
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/** Word boundaries that also treat '-' and '_' as part of a word, so "api" does not match inside "api-v1". */
const mentions = (text: string, name: string) => new RegExp(`(?<![\\w-])${esc(name)}(?![\\w-])`, "i").test(text);

/** Rows that carry information. found:false and error rows count 0; a ripple row counts its teams and conflicts. */
export function countRows(rows: Row[]): number {
  const real = rows.filter((r) => r.found !== false && r.error === undefined);
  const r0 = real[0];
  if (real.length === 1 && Array.isArray(r0.teams)) return r0.teams.length + (Array.isArray(r0.conflicts) ? r0.conflicts.length : 0);
  return real.length;
}

/** The thing an unknown-id row says it could not resolve; undefined when every id resolved. */
function unresolved(c: Call): string | undefined {
  const a = (c.args ?? {}) as Record<string, string>;
  for (const r of c.rows) {
    if (r.found !== false) continue;
    if (Array.isArray(r.knownDecisions)) return a.decisionId;
    if (Array.isArray(r.knownSystems) && !(r.knownSystems as { id: string }[]).some((s) => s.id === a.systemId)) return a.systemId;
  }
  return undefined;
}

// id -> names per graph, one query per 5 minutes.
const TTL_MS = 5 * 60_000;
const byName = new Map<string, { at: number; p: Promise<Names> }>();
const byHandle = new WeakMap<Graph, { at: number; p: Promise<Names> }>();
export function entityNames(g: Graph, now = Date.now()): Promise<Names> {
  const key = graphName(g);
  const hit = key ? byName.get(key) : byHandle.get(g);
  if (hit && now - hit.at < TTL_MS) return hit.p;
  const p = roQuery<{ id: string; name: string; kind: string }>(g, load("entity-names").text)
    .then((rows) => new Map(rows.map((r) => [r.id, { name: r.name, kind: r.kind }] as const)) as Names);
  const e = { at: now, p };
  if (key) byName.set(key, e); else byHandle.set(g, e);
  p.catch(() => (key ? byName.delete(key) : byHandle.delete(g))); // never cache a failure
  return p;
}

/** Everything the tools returned, as one lowercase blob. The "known*" lists are menus of every id, not results. */
function evidence(calls: Call[]): string {
  const strip = (_k: string, v: unknown) => (_k === "knownSystems" || _k === "knownDecisions" ? undefined : v);
  return calls.flatMap((c) => [JSON.stringify(c.rows, strip), ...(c.quotes ?? []),
    // A found:false call names its subject in the args ("nothing connects fax-gateway"); that is not a claim about results.
    ...(countRows(c.rows) === 0 ? [JSON.stringify(c.args ?? {})] : [])]).join("\n");
}

/** Deterministic summary of the rows: "Ripple found 3 teams: A, B, C via …", or the right empty outcome. */
function build(calls: Call[], names: Names, oc: Outcome["outcome"]): { text: string; paths: string[] } {
  const label = (id: unknown) => (typeof id === "string" ? names.get(id)?.name ?? id : String(id));
  if (oc === "unknown_entity") {
    const what = calls.map(unresolved).filter(Boolean).join(", ");
    return { text: `Ripple does not know "${what}", so no traversal ran. Check the name against your org graph and ask again.`, paths: [] };
  }
  if (oc !== "path") {
    const what = calls.flatMap((c) => Object.values((c.args ?? {}) as Record<string, unknown>).filter((v): v is string => typeof v === "string")).join(", ");
    return { text: `Ripple found nothing in the graph${what ? ` for ${what}` : ""}. That does not mean no impact: the dependency may not be modelled.`, paths: [] };
  }
  const teams = new Map<string, string[]>();
  const other: string[] = [];
  for (const r of calls.flatMap((c) => c.rows)) {
    if (r.found === false || r.error !== undefined) continue;
    if (Array.isArray(r.teams)) for (const t of r.teams as { teamId: string; why?: string[] }[]) teams.set(label(t.teamId), t.why ?? []);
    else other.push(label(r.name ?? r.title ?? r.teamId ?? r.personId ?? r.id ?? r.systemId ?? r.customerId ?? "result"));
  }
  const paths = [...teams].map(([t, why]) => (why.length ? `${t} via ${why.join("; ")}` : t));
  if (teams.size) return { text: `Ripple found ${teams.size} ${teams.size === 1 ? "team" : "teams"}: ${[...teams.keys()].join(", ")}.${paths.some((p) => p.includes(" via ")) ? ` Paths: ${paths.filter((p) => p.includes(" via ")).join("; ")}.` : ""}`, paths };
  const list = [...new Set(other)];
  return { text: `Ripple found ${list.length} ${list.length === 1 ? "result" : "results"}: ${list.slice(0, 8).join(", ")}${list.length > 8 ? ", …" : ""}.`, paths: list.slice(0, 10) };
}

export function validateAnswer(answer: string, calls: Call[], names: Names): Verdict {
  const rowCount = calls.reduce((n, c) => n + countRows(c.rows), 0);
  const outcome: Outcome["outcome"] = rowCount ? "path" : calls.some(unresolved) ? "unknown_entity" : "not_in_graph";
  const reasons: string[] = [];
  const text = answer.replace(/\[\[[^\]]*\]\]/g, "");

  const seen = evidence(calls);
  const mentioned = [...names].filter(([, e]) => e.name.length >= 3 && mentions(text, e.name));
  for (const [id, e] of mentioned) if (!mentions(seen, id) && !mentions(seen, e.name)) reasons.push(`names ${e.kind.toLowerCase()} "${e.name}" which no tool result contains`);

  const traversals = calls.filter((c) => TRAVERSALS.has(c.tool));
  const empty = traversals.length ? traversals.every((c) => countRows(c.rows) === 0) : rowCount === 0;
  if (empty && CLAIM.test(text)) reasons.push("claims impact (or none) although the traversal returned no rows");

  const ok = reasons.length === 0;
  const fb = ok ? undefined : build(calls, names, outcome);
  const paths = fb?.paths ?? build(calls, names, outcome).paths;
  return { ok, reasons, answer: fb ? fb.text : answer, outcome: { outcome, entities: mentioned.map(([, e]) => e.name), paths, rowCount } };
}
