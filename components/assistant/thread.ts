// Assistant thread state: pure functions over StreamEvents, so the UI, history replay and tests share one reducer.
import { addText } from "@/components/ask/parseStream";
import { z } from "zod";
import { STARTER_PROMPTS } from "@/lib/assistant/prompts";
import { OUTCOMES, Suggestion, type Outcome, type StreamEvent } from "@/lib/schemas";

/** A numbered source: one number per artifact, in first-cited order. */
export type Cite = { n: number; artifactId: string; quote: string };
export type ToolRun = { tool: string; args: Record<string, unknown>; cypher: string; rows?: Record<string, unknown>[]; rowCount?: number; ms?: number };
export type Tok = { text: string; cite?: number };
export type Turn = {
  id: string;
  question: string;
  agent?: string;
  tools: ToolRun[];
  tokens: Tok[];
  sources: Cite[];
  done: boolean;
  /** The last token is a word still streaming, so the next delta may continue it. */
  glue?: boolean;
  outcome?: Outcome["outcome"];
  rejected?: boolean;
  /** Chips under the reply (small talk / help, or "Which change do you mean?"). */
  suggestions?: { kind: "help" | "choose"; items: Suggestion[] };
  cached?: boolean;
  exhausted?: boolean;
  error?: string;
};
export type Thread = { id: string; title: string; updatedAt: number; turns: Turn[]; conversationId?: string };
export type Meta = Extract<StreamEvent, { type: "meta" }>;

export const newTurn = (question: string, agent?: string): Turn => ({ id: crypto.randomUUID(), question, agent, tools: [], tokens: [], sources: [], done: false });

/** Folds one stream event into the turn. `meta` only marks cached/exhausted here; the page keeps the budget. */
export function applyEvent(t: Turn, e: StreamEvent): Turn {
  switch (e.type) {
    case "meta":
      return { ...t, cached: e.cached, exhausted: e.exhausted, agent: e.agent ?? t.agent };
    case "tool_call":
      return { ...t, tools: [...t.tools, { tool: e.tool, args: e.args, cypher: e.cypher }] };
    case "tool_result": {
      const i = t.tools.findIndex((x) => x.tool === e.tool && x.rows === undefined);
      if (i < 0) return t;
      const tools = [...t.tools];
      tools[i] = { ...tools[i], rows: e.rows, rowCount: e.rowCount ?? e.rows.length, ms: e.ms };
      return { ...t, tools };
    }
    case "text_delta":
      return addText(t, e.text);
    case "citation": {
      const sources = [...t.sources];
      const marks: number[] = [];
      for (const s of e.sources) {
        const i = sources.findIndex((x) => x.artifactId === s.artifactId);
        let c = sources[i];
        if (!c) sources.push((c = { n: sources.length + 1, artifactId: s.artifactId, quote: s.quote }));
        else if (s.quote.length > c.quote.length) sources[i] = c = { ...c, quote: s.quote }; // keep the richer quote
        if (!marks.includes(c.n)) marks.push(c.n);
      }
      return { ...t, sources, tokens: [...t.tokens, ...marks.map((n) => ({ text: "", cite: n }))], glue: false };
    }
    case "suggestions":
      return { ...t, suggestions: { kind: e.kind, items: e.items } };
    case "done":
      return { ...t, done: true, outcome: e.outcome?.outcome, rejected: !!e.rejected?.length };
  }
}

/** The answer as plain text with [n] markers, for copy and for the next request's history. */
export function answerText(t: Turn): string {
  return t.tokens.map((k) => (k.cite ? `[${k.cite}]` : k.text)).join(" ").replace(/ (\[\d+\])/g, "$1").trim();
}

/** The answer as a person copies it: no [n] markers (#274). */
export const plainAnswer = (t: Turn) => answerText(t).replace(/\s?\[\d+\]/g, "").trim();

/** What an answer was based on, so a follow-up ("which of those customers…") keeps the change, names and figures (#274). */
export function turnContext(t: Turn, max = 1500): string {
  const facts = t.tools.filter((r) => r.rows?.length).map((r) => `${r.tool} ${JSON.stringify(r.args)}: ${JSON.stringify(r.rows).slice(0, 500)}`);
  const quotes = t.sources.map((s) => `"${s.quote}"`);
  const lines = [...(facts.length ? [`Looked up: ${facts.join("; ")}`] : []), ...(quotes.length ? [`Quoted: ${quotes.join("; ")}`] : [])];
  return lines.length ? `\n\n(Context for follow-ups, not shown to the person. ${lines.join(" ")})`.slice(0, max) : "";
}

/** Thread turns -> /api/chat messages (finished turns only, then the new question). */
export function toMessages(turns: Turn[], question: string) {
  const msgs = turns.filter((t) => t.done && !t.error).flatMap((t) => {
    const a = plainAnswer(t);
    return a ? [{ role: "user" as const, content: t.question }, { role: "assistant" as const, content: (a.slice(0, 2400) + turnContext(t)).slice(0, 4000) }] : [];
  });
  return [...msgs.slice(-38), { role: "user" as const, content: question }];
}

// Tool trace in plain words (#274): the summary says what Ripple checked; the Cypher stays inside the expander.
const TOOL_LABELS: Record<string, string> = {
  ripple: "What the change touches", ripple_impact: "What the change touches", why_affected: "Why a team is affected", weighted_path: "How it reaches a team",
  search: "Searched what Ripple knows", who_knows: "Who knows it", list_decisions: "Open changes", contract_conflicts: "Contract conflicts",
  deals_at_risk: "Deals at risk", customers_at_risk: "Customers at risk", access_gap: "Access gaps", list_agents: "Agents", run_agent: "Asked another agent",
};
export const toolLabel = (tool: string) => TOOL_LABELS[tool] ?? tool.replace(/^propose_/, "Draft: ").replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
export const traceSummary = (n: number) => `Checked ${n} ${n === 1 ? "source" : "sources"}`;
export const resultNote = (rowCount?: number) => (rowCount === undefined ? "checking…" : rowCount ? `${rowCount} ${rowCount === 1 ? "result" : "results"}` : "nothing found");

/** Thread title: the question, cut at 60 characters by grapheme so an emoji or accent is never split. */
export const titleOf = (q: string) => {
  const g = Array.from(new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(q), (s) => s.segment);
  return g.length > 60 ? `${g.slice(0, 57).join("").trimEnd()}…` : q;
};

/** Slash commands: each one expands to a prompt (the bare forms are the cached starters) or opens a page. */
export const COMMANDS = [
  { key: "impact", name: "/impact", desc: "What a change touches" },
  { key: "who-wasnt-told", name: "/who-wasnt-told", desc: "Affected teams nobody told" },
  { key: "conflicts", name: "/conflicts", desc: "Contracts a change breaks" },
  { key: "report", name: "/report", desc: "Open a case file, e.g. /report d-1" },
];

export function expandCommand(text: string): { prompt: string } | { href: string } {
  const m = text.trim().match(/^\/([a-z-]+)(?:\s+([\s\S]*))?$/i);
  const arg = m?.[2]?.trim();
  switch (m?.[1].toLowerCase()) {
    case "impact":
      return { prompt: arg ? `What does ${arg} touch?` : STARTER_PROMPTS[1] };
    case "who-wasnt-told":
      return { prompt: arg ? `Which teams have not been told about ${arg}?` : STARTER_PROMPTS[2] };
    case "conflicts":
      return { prompt: arg ? `Do any contracts conflict with ${arg}?` : STARTER_PROMPTS[3] };
    case "report":
      return { href: arg ? `/reports/${encodeURIComponent(arg.split(/\s/)[0])}` : "/reports" };
    default:
      return { prompt: text.trim() };
  }
}

/** Registry agents (lib/agent/agents/*) with display names. ponytail: static until /api/agents carries display names (#235). */
export const AGENTS = [
  { key: "ask", name: "Ask Ripple", desc: "Any question, with the quote" },
  { key: "impact", name: "Impact Analyst", desc: "Follows a change through the graph" },
  { key: "contract", name: "Contract Sentinel", desc: "Legal: what you promised" },
  { key: "exposure", name: "Customer Exposure", desc: "Sales and CS: who is at risk" },
  { key: "access", name: "Access Planner", desc: "IT: access a change forces" },
  { key: "security", name: "Security Specialist", desc: "Security: tokens, keys, controls" },
  { key: "docs", name: "Docs Specialist", desc: "DevRel: docs that go stale" },
  { key: "support", name: "Support Specialist", desc: "Support: what customers ask" },
  { key: "advisor", name: "Decision Advisor", desc: "Leadership: weigh the options" },
  { key: "digest", name: "Digest", desc: "What changed this week" },
];
export const agentName = (key?: string) => AGENTS.find((a) => a.key === key)?.name;

// History in the browser (demo and no-DB self-host). Postgres-backed orgs use /api/conversations instead.
export const THREADS_KEY = "ripple.v2.threads";
/** One history per demo lens: a thread asked as Legal shows Legal's redactions, so it never shows up under another lens. */
export const threadsKey = (lens?: string) => (lens ? `${THREADS_KEY}.${lens}` : THREADS_KEY);
const MAX_THREADS = 30;

const ThreadSchema = z.object({
  id: z.string(),
  title: z.string(),
  updatedAt: z.number(),
  conversationId: z.string().optional(),
  turns: z.array(z.object({
    id: z.string(),
    question: z.string(),
    agent: z.string().optional(),
    tools: z.array(z.object({ tool: z.string(), args: z.record(z.string(), z.unknown()), cypher: z.string(), rows: z.array(z.record(z.string(), z.unknown())).optional(), rowCount: z.number().optional(), ms: z.number().optional() })),
    tokens: z.array(z.object({ text: z.string(), cite: z.number().int().positive().optional() })),
    sources: z.array(z.object({ n: z.number().int().positive(), artifactId: z.string(), quote: z.string() })),
    done: z.boolean(),
    glue: z.boolean().optional(),
    outcome: z.enum(OUTCOMES).optional(),
    rejected: z.boolean().optional(),
    suggestions: z.object({ kind: z.enum(["help", "choose"]), items: z.array(Suggestion) }).optional(),
    cached: z.boolean().optional(),
    exhausted: z.boolean().optional(),
    error: z.string().optional(),
  })),
});

/** Stored threads, each validated; anything malformed (old versions, hand edits) is dropped. */
export function loadThreads(store: Pick<Storage, "getItem"> | undefined = globalThis.localStorage, key = THREADS_KEY): Thread[] {
  try {
    const v: unknown = JSON.parse(store?.getItem(key) ?? "[]");
    return Array.isArray(v) ? v.flatMap((t) => { const r = ThreadSchema.safeParse(t); return r.success ? [r.data] : []; }) : [];
  } catch {
    return [];
  }
}

export function saveThreads(threads: Thread[], store: Pick<Storage, "setItem"> | undefined = globalThis.localStorage, key = THREADS_KEY) {
  try {
    // Unfinished turns are saved as finished: a reload never resumes a stream.
    const clean = threads.slice(0, MAX_THREADS).map((t) => ({ ...t, turns: t.turns.map((u) => ({ ...u, done: true })) }));
    store?.setItem(key, JSON.stringify(clean));
  } catch {
    // storage full or blocked: history is a convenience
  }
}

/** Inserts or replaces a thread and keeps newest first. */
export const upsertThread = (threads: Thread[], t: Thread) => [t, ...threads.filter((x) => x.id !== t.id)].sort((a, b) => b.updatedAt - a.updatedAt);

/** Rebuilds turns from stored conversation messages (Postgres keeps each answer's events). */
export function turnsFromMessages(msgs: { role: string; content: string; events?: unknown }[]): Turn[] {
  const turns: Turn[] = [];
  for (const m of msgs) {
    if (m.role === "user") turns.push({ ...newTurn(m.content), done: true });
    else if (turns.length) {
      const last = turns.length - 1;
      const events = Array.isArray(m.events) ? (m.events as StreamEvent[]) : [];
      turns[last] = events.length ? events.reduce(applyEvent, turns[last]) : addText(turns[last], m.content);
      turns[last].done = true;
    }
  }
  return turns;
}
