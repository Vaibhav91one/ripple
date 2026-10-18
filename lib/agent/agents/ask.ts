// Today's /api/ask agent as a definition. The loop still runs it with the same tools and prompt.
import { z } from "zod";
import { defineAgent } from "../define";
import { SYSTEM } from "../loop";
import { READ_TOOLS } from "../tools";

export const ask = defineAgent({
  name: "ask",
  displayName: "Ask Ripple",
  tagline: "Answers questions about your company from the graph, with sources.",
  group: "ask",
  team: "everyone",
  model: "reasoning",
  tools: READ_TOOLS,
  writes: [],
  budget: { maxSteps: 5, maxTokens: 20_000 },
  trigger: {},
  input: z.object({ question: z.string() }),
  output: z.object({ answer: z.string() }),
  system: () => SYSTEM,
});
