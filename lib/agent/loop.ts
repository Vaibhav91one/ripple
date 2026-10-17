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

export const SYSTEM = `You are Ripple's analyst for a company knowledge graph. Answer only from tool results.
Call tools to find facts; you cannot write queries. Be concise (2-4 sentences).
After every factual claim, cite the supporting artifact as [[artifact-id]] using ONLY ids returned in tool results (sourceIds).
If the tools return nothing relevant, say you could not find it. Never invent ids.
Ids are short slugs (systems like api-v1 or auth-service, decisions like d-1). If you are not sure of an exact id, call search first and use ids from its results; never pass a made-up id. If a guessed id returns found:false, search once before giving up. who_knows takes a system id (e.g. auth flow -> auth-service), never an artifact id from search results (art-*, pr-*).
Team ids are lowercase (eng, support, sales, legal, security, devrel, leadership, data). For "why is team X affected" call why_affected; for hidden or indirect dependencies call ripple with depth 4.
If a tool returns found:false, say plainly that the graph has nothing on it and the dependency may not be modelled. Do not guess or fill in from general knowledge.`;

export type LoopOpts = {
  model: LanguageModel;
  question: string;
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
  const ctx = { g: o.g, now: o.now, demo: o.demo ?? false, readonly: o.readonly, viewer: o.viewer, propose: o.propose };

  const tools = Object.fromEntries(
    READ_TOOLS.map((name) => {
      const d = TOOLS[name];
      return [name, tool({
        description: d.description,
        inputSchema: d.input as z.ZodType,
        execute: async (args: unknown) => {
          const ev = { action: "agent.tool", resourceType: "tool", resourceId: name, read: true };
          const raw = await (d.run as (c: typeof ctx, a: unknown) => ReturnType<typeof d.run>)(ctx, args).catch(async (e) => {
            if (e instanceof Error && e.message === "demo_readonly") await o.audit?.({ ...ev, outcome: "deny" });
            throw e;
          });
          const out = await redactToolOut(o.g, o.viewer, raw); // before the model (and the stream) sees a row
          if (ev.read) void o.audit?.(ev); else await o.audit?.(ev); // tool name only, never the payload
          for (const s of out.sources) if (!returned.has(s.artifactId)) returned.set(s.artifactId, s);
          return { rows: out.rows, sourceIds: out.sources.map((s) => s.artifactId), cypher: out.cypher, restricted: out.restricted };
        },
      })];
    }),
  );

  let buf = "";
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
    system: SYSTEM,
    prompt: o.question,
    tools,
    stopWhen: isStepCount(o.maxSteps ?? 5),
  });

  for await (const part of result.fullStream) {
    if (part.type === "tool-call") {
      const t = TOOLS[part.toolName as ToolName];
      yield { type: "tool_call", tool: part.toolName, args: (part.input ?? {}) as Record<string, unknown>, cypher: t ? templateText(t.templates) : "" };
    } else if (part.type === "tool-result") {
      const out = part.output as { rows: Row[]; sourceIds: string[] };
      if (out.rows.some((r) => r.found === false)) notFound = true;
      yield { type: "tool_result", tool: part.toolName, rows: out.rows, sourceIds: out.sourceIds };
    } else if (part.type === "tool-error") {
      yield { type: "tool_result", tool: part.toolName, rows: [{ error: String(part.error) }], sourceIds: [] };
    } else if (part.type === "text-delta") {
      buf += part.text;
      yield* drain(false);
    } else if (part.type === "error") {
      throw part.error instanceof Error ? part.error : new Error(String(part.error));
    }
  }
  yield* drain(true);
  if (spoke && cited === 0 && !notFound) yield { type: "text_delta", text: " (unverified: no source was cited for this answer)" };
  o.onUsage?.((await result.totalUsage).totalTokens ?? 0);
  yield { type: "done" };
}
