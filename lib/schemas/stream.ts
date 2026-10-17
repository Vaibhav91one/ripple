import { z } from "zod";
import { id } from "./common";
import { Source } from "./core";

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
  }),
  z.object({ type: z.literal("text_delta"), text: z.string() }),
  z.object({
    type: z.literal("citation"),
    claimId: id,
    sources: z.array(Source),
  }),
  z.object({ type: z.literal("done") }),
]);

export type StreamEvent = z.infer<typeof StreamEvent>;
