import { z } from "zod";
import { id } from "./common";
import { Source } from "./core";

export const OUTCOMES = ["path", "memory", "not_in_graph", "unknown_entity"] as const;
/** How an answer relates to the graph. `memory` is produced by agent memory (#210); validation never sets it. */
export const Outcome = z.object({
  outcome: z.enum(OUTCOMES),
  entities: z.array(z.string()),
  paths: z.array(z.string()),
  rowCount: z.number().int().min(0),
});
export type Outcome = z.infer<typeof Outcome>;

/** A chip under a reply: `prompt` is sent as the next message, `href` navigates. */
export const Suggestion = z.object({ label: z.string(), prompt: z.string().optional(), href: z.string().optional() });
export type Suggestion = z.infer<typeof Suggestion>;

export const StreamEvent = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("tool_call"),
    tool: z.string(),
    args: z.record(z.string(), z.unknown()),
    cypher: z.string(),
  }),
  z.object({
    type: z.literal("tool_result"),
    tool: z.string(),
    rows: z.array(z.record(z.string(), z.unknown())),
    sourceIds: z.array(id),
    /** Execution trace: wall time of the call and its row count (found:false counts 0). */
    ms: z.number().optional(),
    rowCount: z.number().optional(),
  }),
  z.object({ type: z.literal("text_delta"), text: z.string() }),
  z.object({
    type: z.literal("citation"),
    claimId: id,
    sources: z.array(Source),
  }),
  /** First event of every /api/chat stream: the demo budget and where the thread lives. */
  z.object({
    type: z.literal("meta"),
    /** Live prompts left today; null = unlimited (self-host, signed-in orgs). */
    remaining: z.number().int().min(0).nullable(),
    limit: z.number().int().nullable(),
    /** Served from the cache (starter prompt, agent sample, tour): did not count against the quota. */
    cached: z.boolean(),
    /** The daily budget is spent; the stream is the cached tour. */
    exhausted: z.boolean(),
    /** false = demo: the client keeps the thread in localStorage. */
    persist: z.boolean(),
    conversationId: z.string().optional(),
    agent: z.string().optional(),
  }),
  /** Clickable follow-ups: `help` after small talk (the client swaps in the real open changes), `choose` = "Which change do you mean?". */
  z.object({ type: z.literal("suggestions"), kind: z.enum(["help", "choose"]), items: z.array(Suggestion) }),
  z.object({ type: z.literal("done"), outcome: Outcome.optional(), /** Why validation replaced the model's answer, when it did. */ rejected: z.array(z.string()).optional() }),
]);

export type StreamEvent = z.infer<typeof StreamEvent>;
