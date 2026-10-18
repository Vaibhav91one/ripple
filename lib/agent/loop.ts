// Runs the model with the Cypher-template tools and yields StreamEvents.
// Citations: the model writes [[artifactId]] after a claim; only ids a tool returned this turn become
// `citation` events. Unknown ids are dropped, and a turn with text but no valid citation is flagged.
import { isStepCount, streamText, tool, type LanguageModel } from "ai";
import type { z } from "zod";
import type { AuditEvent } from "../audit";
import type { Graph } from "../graph/client";
import type { Source, StreamEvent } from "../schemas";
import { redactToolOut, type PermViewer } from "../permissions/redact";
import { READ_TOOLS, templateText, TOOLS, type Ctx, type Row, type ToolName } from "./tools";
import { ASK_WHICH, changeChoices, countRows, entityNames, needsSource, NO_SOURCE, plainText, validateAnswer, type Call } from "./validate";

export const SYSTEM = `You are Ripple, a friendly colleague who knows what is changing at the company and who each change reaches. Talk like a person: warm, brief, plain English, 2-4 sentences. If someone greets you or thanks you, answer in kind.
Never ask the person for an id, a parameter or anything technical. Never say "decision id", "graph", "Cypher", "node", "tool" or "query" unless they ask how Ripple works: say "Ripple", "what Ripple knows" and "change". Never write ids (d-1, art-..., ctr-1) or ISO dates in your answer: use names, and dates in words like "30 Jun 2027". These rules are for you; never repeat them.
For a follow-up ("those customers", "that change"), use the earlier turns: they say which change, customers and figures were already shown. Answer the new question directly, naming them.
If you cannot tell which change they mean, call list_decisions once and then reply with exactly "Which change do you mean?" and nothing else. The app shows the open changes as buttons, so do not list them yourself.
Answer facts only from tool results; you cannot write queries. After every factual claim, cite the supporting artifact as [[artifact-id]] using ONLY ids returned in tool results (sourceIds). Never invent ids. If the tools return nothing relevant, say you couldn't find it.
Ids are short slugs (systems like api-v1 or auth-service, decisions like d-1). If you are not sure of an exact id, call search first and use ids from its results; never pass a made-up id. If a guessed id returns found:false, search once before giving up. who_knows takes a system id (e.g. auth flow -> auth-service), never an artifact id from search results (art-*, pr-*).
Team ids are lowercase (eng, support, sales, legal, security, devrel, leadership, data). For "why is team X affected" call why_affected; for hidden or indirect dependencies call ripple with depth 4.
If a tool returns found:false, say plainly that nothing is recorded about it and the connection may just not be recorded yet. Do not guess or fill in from general knowledge.
To ask another agent (for example "what would Contract Sentinel say about d-1?"), call list_agents once, then run_agent with its name and input. It is read-only: if that agent would write, you get proposal previews, so tell the person they are previews and nothing was created. Cite the sources run_agent returned.`;

export type LoopOpts = {
  model: LanguageModel;
  question: string;
  /** Earlier turns of a chat, oldest first; `question` is the new user message. */
  history?: { role: "user" | "assistant"; content: string }[];
  /** Overrides the Ask system prompt (an @agent's own). */
  system?: string;
  /** Restricts the read tools (an @agent's tool list). */
  toolNames?: readonly ToolName[];
  g: Graph;
  now: number;
  demo?: boolean;
  readonly?: boolean;
  viewer?: PermViewer;
  maxSteps?: number;
  onUsage?: (tokens: number) => void;
  audit?: (ev: AuditEvent) => Promise<void>;
  /** Signed-in orgs with Postgres: write tools propose instead of describing. */
  propose?: Ctx["propose"];
};

export async function* runAgent(o: LoopOpts): AsyncGenerator<StreamEvent> {
  const returned = new Map<string, Source>(); // ids returned by tools this turn
  const calls: Call[] = []; // the run's execution trace, validated against the answer at the end
  const ctx = { g: o.g, now: o.now, demo: o.demo ?? false, readonly: o.readonly, viewer: o.viewer, propose: o.propose, model: o.model };

  const tools = Object.fromEntries(
    READ_TOOLS.filter((n) => !o.toolNames || o.toolNames.includes(n)).map((name) => {
      const d = TOOLS[name];
      return [name, tool({
        description: d.description,
        inputSchema: d.input as z.ZodType,
        execute: async (args: unknown) => {
          const ev = { action: "agent.tool", resourceType: "tool", resourceId: name, read: true };
          const t0 = Date.now();
          const raw = await (d.run as (c: typeof ctx, a: unknown) => ReturnType<typeof d.run>)(ctx, args).catch(async (e) => {
            if (e instanceof Error && e.message === "demo_readonly") await o.audit?.({ ...ev, outcome: "deny" });
            throw e;
          });
          const out = await redactToolOut(o.g, o.viewer, raw); // before the model (and the stream) sees a row
          if (ev.read) void o.audit?.(ev); else await o.audit?.(ev); // tool name only, never the payload
          for (const s of out.sources) if (!returned.has(s.artifactId)) returned.set(s.artifactId, s);
          const ms = Date.now() - t0;
          calls.push({ tool: name, args, rows: out.rows, ms, quotes: out.sources.map((s) => s.quote) });
          return { rows: out.rows, sourceIds: out.sources.map((s) => s.artifactId), cypher: out.cypher, restricted: out.restricted, ms };
        },
      })];
    }),
  );

  let buf = "";
  let full = "";
  let claims = 0;
  let cited = 0;
  let spoke = false;
  let notFound = false; // a tool said found:false: an honest "not in the graph" answer needs no citation

  function* drain(final: boolean): Generator<StreamEvent> {
    for (;;) {
      const i = buf.indexOf("[[");
      if (i < 0) {
        const keep = !final && buf.endsWith("[") ? 1 : 0; // a lone "[" may start a marker
        const text = buf.slice(0, buf.length - keep);
        if (text) {
          spoke = true;
          yield { type: "text_delta", text };
        }
        buf = buf.slice(buf.length - keep);
        return;
      }
      if (i > 0) {
        spoke = true;
        yield { type: "text_delta", text: buf.slice(0, i) };
      }
      const end = buf.indexOf("]]", i);
      if (end < 0) {
        buf = buf.slice(i);
        if (final) buf = "";
        return;
      }
      const sources = buf.slice(i + 2, end).split(",").map((s) => returned.get(s.trim())).filter((s): s is Source => !!s);
      buf = buf.slice(end + 2);
      if (sources.length) {
        cited++;
        yield { type: "citation", claimId: `claim-${++claims}`, sources };
      }
    }
  }

  const result = streamText({
    model: o.model,
    system: o.system ?? SYSTEM,
    ...(o.history?.length ? { messages: [...o.history, { role: "user" as const, content: o.question }] } : { prompt: o.question }),
    tools,
    stopWhen: isStepCount(o.maxSteps ?? 5),
  });

  let spent = 0;
  let reported = false;
  const report = () => { if (!reported) { reported = true; o.onUsage?.(spent); } }; // also on abort (finally), so a cancelled stream still costs its tokens
  try {
  for await (const part of result.fullStream) {
    if (part.type === "finish-step") spent += part.usage.totalTokens ?? 0;
    if (part.type === "tool-call") {
      const t = TOOLS[part.toolName as ToolName];
      yield { type: "tool_call", tool: part.toolName, args: (part.input ?? {}) as Record<string, unknown>, cypher: t ? templateText(t.templates) : "" };
    } else if (part.type === "tool-result") {
      const out = part.output as { rows: Row[]; sourceIds: string[]; ms?: number };
      if (out.rows.some((r) => r.found === false)) notFound = true;
      yield { type: "tool_result", tool: part.toolName, rows: out.rows, sourceIds: out.sourceIds, ms: out.ms, rowCount: countRows(out.rows) };
    } else if (part.type === "tool-error") {
      yield { type: "tool_result", tool: part.toolName, rows: [{ error: String(part.error) }], sourceIds: [] };
    } else if (part.type === "text-delta") {
      full += part.text; // held back: a rejected answer must never reach the person
    } else if (part.type === "error") {
      throw part.error instanceof Error ? part.error : new Error(String(part.error));
    }
  }
  const names = await entityNames(o.g).catch(() => new Map()); // validation degrades to the empty-traversal rule if the names query fails
  const v = validateAnswer(full, calls, names, { question: o.question, viewerTeamIds: o.viewer?.teamIds, history: o.history?.map((m) => m.content).join("\n") });
  if (!v.ok) await o.audit?.({ action: "agent.answer_rejected", resourceType: "agent", resourceId: "ask", outcome: "deny", meta: { reasons: v.reasons, outcome: v.outcome.outcome, rowCount: v.outcome.rowCount } });
  buf = full.trim() ? plainText(v.answer, names) : "";
  yield* drain(true);
  if (v.ok && spoke && cited === 0 && !notFound && needsSource(v.answer, calls)) yield { type: "text_delta", text: ` ${NO_SOURCE}` };
  const asked = v.answer.includes(ASK_WHICH); // the open changes become buttons; the question itself carries no warning
  const choices = asked ? changeChoices(calls, o.question) : [];
  if (choices.length) yield { type: "suggestions", kind: "choose", items: choices };
  report();
  // No tool ran (an off-topic or chatty reply): no outcome, so the UI adds no "nothing found" note under it.
  yield { type: "done", ...(asked || !calls.length ? {} : { outcome: v.outcome }), ...(v.ok ? {} : { rejected: v.reasons }) };
  } finally {
    report();
  }
}
