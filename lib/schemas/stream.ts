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
  z.object({ type: z.literal("done"), outcome: Outcome.optional(), /** Why validation replaced the model's answer, when it did. */ rejected: z.array(z.string()).optional() }),
]);

export type StreamEvent = z.infer<typeof StreamEvent>;
