// Answer validation (#211). After a run, every org entity the answer names must appear in this run's tool results,
// and an empty traversal can never be answered with impact or "safe". On failure the answer is rebuilt from the rows:
// a flatter, correct answer beats a confident, wrong one. Pure functions; only entityNames touches the graph.
import { roQuery, graphName, type Graph } from "../graph/client";
import { load } from "../graph/queries";
import type { Outcome, Suggestion } from "../schemas";

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
const CUE = /^\s*(?:(?:team|system|service|is|are|was|were|has|have|owns|owned|depends|will|would|may|might|and|or)\b|,|'s|\u2019s)/i;
const NOUN = /^\s+(?:team|system|service)\b/i;
/** A mention of an entity in an answer. Multi-word names match case-insensitively. A single word ("Support", "Data", "Legal") is
 *  also an ordinary word, so it counts only when written as a name: capitalised mid-sentence; capitalised at the start of a
 *  sentence and followed by a verb or list cue; or any case right before "team", "system" or "service". */
function namedIn(text: string, name: string): boolean {
  if (/\s/.test(name)) return mentions(text, name);
  for (const m of text.matchAll(new RegExp(`(?<![\\w-])${esc(name)}(?![\\w-])`, "gi"))) {
    const after = text.slice(m.index + m[0].length);
    if (NOUN.test(after)) return true;
    if (m[0] !== name) continue;
    const start = /(?:^|[.!?:]\s+|\n\s*(?:[-*]|\d+[.)])?\s*)$/.test(text.slice(0, m.index));
    if (!start || CUE.test(after)) return true;
  }
  return false;
}
export type Context = { /** The person's question: a single word they used themselves is not an entity claim. */ question?: string; /** Earlier turns of the chat: a follow-up may name what an earlier answer already showed. */ history?: string; /** Ids of the viewer's own teams: never counted. */ viewerTeamIds?: readonly string[] };

/** Rows that carry information. found:false and error rows count 0; a ripple row counts its teams and conflicts. */
export function countRows(rows: Row[]): number {
  const real = rows.filter((r) => r.found !== false && r.error === undefined);
  const r0 = real[0];
  if (real.length === 1 && Array.isArray(r0.teams)) return r0.teams.length + (Array.isArray(r0.conflicts) ? r0.conflicts.length : 0);
  return real.length;
}

export const ASK_WHICH = "Which change do you mean?";
export const NOTHING_CONNECTED = "Ripple hasn't learned about that yet. Connect the repo or Slack channel where it lives, or import a CSV, and ask again.";
export const NO_SOURCE = "I couldn't find a source for that in what Ripple knows, so treat it as a guess.";

/** The no-source notice is for factual claims only: a greeting, a question back or a clarification is not one. ponytail: a tool call or a digit counts as a claim; swap for a classifier if it misfires. */
export function needsSource(answer: string, calls: Call[]): boolean {
  const t = answer.replace(/\[\[[^\]]*\]\]/g, "").trim();
  return !!t && !/\?\s*$/.test(t) && !NOT_FOUND.test(t) && (calls.length > 0 || /\d/.test(t));
}
/** An answer that already says it found nothing: a "treat it as a guess" notice after it would contradict it. */
const NOT_FOUND = /\b(?:couldn'?t|could not|can'?t|cannot|didn'?t|did not) (?:find|see|open)\b|\bhasn'?t learned\b|\bno record\b|\bnothing (?:is )?recorded\b/i;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const RAW_ID = /\b(?:d|art|ctr|conf|tkt|msg|pr)-[a-z0-9]+(?:-[a-z0-9]+)*\b/g;
/**
 * The answer as a person reads it (#274): ISO dates in words ("30 Jun 2027"), raw ids swapped for their names (or dropped when
 * in brackets and unknown). [[citation]] markers are left alone for the stream to turn into sources.
 */
export function plainText(answer: string, names: Names = new Map()): string {
  return answer.split(/(\[\[[^\]]*\]\])/).map((part, i) => i % 2 ? part : part
    .replace(/\b(\d{4})-(\d{2})-(\d{2})\b/g, (m, y, mo, d) => (MONTHS[Number(mo) - 1] ? `${Number(d)} ${MONTHS[Number(mo) - 1]} ${y}` : m))
    .replace(/\s*\((?:d|art|ctr|conf|tkt|msg|pr)-[a-z0-9-]+\)/g, (m) => { const id = m.trim().slice(1, -1); const n = names.get(id)?.name; return n ? ` (${n})` : ""; })
    .replace(RAW_ID, (id) => names.get(id)?.name ?? id)).join("");
}

/** The changes the person could mean: a failed change lookup's `knownDecisions`, or a list_decisions result. Each becomes a chip that re-asks the question about that change. */
export function changeChoices(calls: Call[], question: string, max = 6): Suggestion[] {
  const seen = new Map<string, string>();
  for (const r of calls.flatMap((c) => c.rows)) {
    const list = Array.isArray(r.knownDecisions) ? (r.knownDecisions as Row[]) : r.kind === undefined && typeof r.id === "string" && typeof r.title === "string" && "status" in r ? [r] : [];
    for (const d of list) if (typeof d.id === "string" && typeof d.title === "string") seen.set(d.id, d.title);
  }
  const q = question.replace(/[?.!\s]+$/, "");
  return [...seen.values()].slice(0, max).map((title) => ({ label: title, prompt: q ? `About "${title}": ${q}` : `What does ${title} touch?` }));
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
    const has = (k: string) => calls.some((c) => c.rows.some((r) => Array.isArray(r[k])));
    if (has("knownDecisions") && !has("knownSystems")) return { text: ASK_WHICH, paths: [] }; // an unknown change id: the UI offers the real ones
    const what = calls.map(unresolved).filter(Boolean).join(", ");
    return { text: `I don't recognise "${what}", so I haven't looked anything up. Check the name and ask again.`, paths: [] };
  }
  if (oc !== "path") return { text: NOTHING_CONNECTED, paths: [] };
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

export function validateAnswer(answer: string, calls: Call[], names: Names, cx: Context = {}): Verdict {
  const rowCount = calls.reduce((n, c) => n + countRows(c.rows), 0);
  const outcome: Outcome["outcome"] = rowCount ? "path" : calls.some(unresolved) ? "unknown_entity" : "not_in_graph";
  const reasons: string[] = [];
  const text = answer.replace(/\[\[[^\]]*\]\]/g, "");

  const seen = `${evidence(calls)}\n${cx.history ?? ""}`;
  const own = new Set(cx.viewerTeamIds);
  const mentioned = [...names].filter(([id, e]) => e.name.length >= 3 && !own.has(id) && namedIn(text, e.name) && !(cx.question && !/\s/.test(e.name) && mentions(cx.question.toLowerCase(), e.name.toLowerCase()) && !new RegExp(`\\b${esc(e.name)}\\b`).test(cx.question)));
  for (const [id, e] of mentioned) if (!mentions(seen, id) && !mentions(seen, e.name)) reasons.push(`names ${e.kind.toLowerCase()} "${e.name}" which no tool result contains`);

  const traversals = calls.filter((c) => TRAVERSALS.has(c.tool));
  const empty = traversals.length ? traversals.every((c) => countRows(c.rows) === 0) : rowCount === 0;
  if (empty && CLAIM.test(text)) reasons.push("claims impact (or none) although the traversal returned no rows");

  const ok = reasons.length === 0;
  const fb = ok ? undefined : build(calls, names, outcome);
  const paths = fb?.paths ?? build(calls, names, outcome).paths;
  return { ok, reasons, answer: fb ? fb.text : answer, outcome: { outcome, entities: mentioned.map(([, e]) => e.name), paths, rowCount } };
}

const ID_KEY = /^(?:team|system|customer|person|contract)Ids?$/;
/** Background runs: entity ids (teamId, systemIds, customerId, ...) a structured output names that no tool returned and the run's input did not give. */
export function invalidIds(output: unknown, calls: Call[], input: unknown = {}): string[] {
  const seen = `${evidence(calls)}\n${JSON.stringify(input ?? {})}`;
  const bad = new Set<string>();
  const walk = (v: unknown, key = ""): void => {
    if (typeof v === "string") { if (ID_KEY.test(key) && !mentions(seen, v)) bad.add(`${key}=${v}`); }
    else if (Array.isArray(v)) v.forEach((x) => walk(x, key));
    else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) walk(x, k);
  };
  walk(output);
  return [...bad];
}
