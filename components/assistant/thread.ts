// Assistant thread state: pure functions over StreamEvents, so the UI, history replay and tests share one reducer.
import { addText } from "@/components/ask/parseStream";
import { STARTER_PROMPTS } from "@/lib/assistant/prompts";
import type { Outcome, StreamEvent } from "@/lib/schemas";

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
        let c = sources.find((x) => x.artifactId === s.artifactId);
        if (!c) sources.push((c = { n: sources.length + 1, artifactId: s.artifactId, quote: s.quote }));
        if (!marks.includes(c.n)) marks.push(c.n);
      }
      return { ...t, sources, tokens: [...t.tokens, ...marks.map((n) => ({ text: "", cite: n }))], glue: false };
    }
    case "done":
      return { ...t, done: true, outcome: e.outcome?.outcome, rejected: !!e.rejected?.length };
  }
}

/** The answer as plain text with [n] markers, for copy and for the next request's history. */
export function answerText(t: Turn): string {
  return t.tokens.map((k) => (k.cite ? `[${k.cite}]` : k.text)).join(" ").replace(/ (\[\d+\])/g, "$1").trim();
}

/** Thread turns -> /api/chat messages (finished turns only, then the new question). */
export function toMessages(turns: Turn[], question: string) {
  const msgs = turns.filter((t) => t.done && !t.error).flatMap((t) => {
    const a = answerText(t);
    return a ? [{ role: "user" as const, content: t.question }, { role: "assistant" as const, content: a.slice(0, 4000) }] : [];
  });
  return [...msgs.slice(-38), { role: "user" as const, content: question }];
}

export const titleOf = (q: string) => (q.length > 60 ? `${q.slice(0, 57).trimEnd()}…` : q);

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
const MAX_THREADS = 30;

export function loadThreads(store: Pick<Storage, "getItem"> | undefined = globalThis.localStorage): Thread[] {
  try {
    const v: unknown = JSON.parse(store?.getItem(THREADS_KEY) ?? "[]");
    return Array.isArray(v) ? v.filter((t): t is Thread => !!t && typeof t.id === "string" && Array.isArray(t.turns)) : [];
  } catch {
    return [];
  }
}

export function saveThreads(threads: Thread[], store: Pick<Storage, "setItem"> | undefined = globalThis.localStorage) {
  try {
    // Unfinished turns are saved as finished: a reload never resumes a stream.
    const clean = threads.slice(0, MAX_THREADS).map((t) => ({ ...t, turns: t.turns.map((u) => ({ ...u, done: true })) }));
    store?.setItem(THREADS_KEY, JSON.stringify(clean));
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
