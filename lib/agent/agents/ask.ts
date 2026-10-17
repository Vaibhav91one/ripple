// Today's /api/ask agent as a definition. The loop still runs it with the same tools and prompt.
import { z } from "zod";
import { defineAgent } from "../define";
import { SYSTEM } from "../loop";
import { TOOLS, type ToolName } from "../tools";

export const ask = defineAgent({
  name: "ask",
  group: "ask",
  team: "everyone",
  model: "reasoning",
  tools: Object.keys(TOOLS) as ToolName[],
  writes: [],
  budget: { maxSteps: 5, maxTokens: 20_000 },
  trigger: {},
  input: z.object({ question: z.string() }),
  output: z.object({ answer: z.string() }),
  system: () => SYSTEM,
});
