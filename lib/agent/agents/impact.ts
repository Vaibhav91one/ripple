// Impact Analyst: explains what a change touches, team by team, with the path of evidence, confidence and freshness. Read-only; the worker emits impact.ready.
// Output schema is OpenAI-strict: every key required, optional values are .nullable().
import { z } from "zod";
import { defineAgent } from "../define";

const Entity = z.object({ id: z.string(), note: z.string().describe("Why it is hit, citing [[artifact-id]]") });

export const ImpactReport = z.object({
  decisionId: z.string(),
  summary: z.string().describe("Two sentences for the change owner, citing [[artifact-id]]"),
  teams: z.array(z.object({
    teamId: z.string(),
    why: z.array(z.object({
      path: z.string().describe("decision -> system -> ... -> team, each hop with its [[artifact-id]]"),
      quotes: z.array(z.string()).describe("Verbatim quotes from the tool results that back the path"),
    })),
    confidence: z.number().describe("0 to 1, from edge confidence and how fresh the edges are"),
    freshness: z.enum(["fresh", "stale"]).describe("stale when the newest edge on the path was observed more than 90 days ago"),
  })),
  customers: z.array(Entity),
  contracts: z.array(Entity),
  deals: z.array(Entity),
  hiddenAtDepth4: z.array(Entity).describe("Teams or systems that appear only when following dependencies 4 hops deep, not at 3"),
});

export const impact = defineAgent({
  name: "impact",
  group: "understand",
  team: "change-owner",
  model: "reasoning",
  tools: ["ripple", "why_affected", "search", "who_knows", "edge_freshness"],
  writes: [],
  budget: { maxSteps: 8, maxTokens: 60_000 },
  trigger: { events: ["change.confirmed", "change.updated"] },
  input: z.object({ decisionId: z.string() }),
  output: ImpactReport,
  system: ({ now }) => `You are the Impact Analyst. The change owner gave you a decision id. Explain what the change touches.
Today is ${new Date(now * 1000).toISOString().slice(0, 10)}.
Work in this order, one tool call per step:
1. ripple with depth 3, then ripple with depth 4. Anything present at 4 and absent at 3 goes in hiddenAtDepth4.
2. why_affected for every hit team other than the decision's own team, to get the path and quotes.
3. edge_freshness (depth 4) to set confidence (edge confidence, lowered when the newest edge is old) and freshness. Edges observed more than 90 days ago are stale.
4. who_knows or search only when a path needs a person or a document.
Rules: cite every claim as [[artifact-id]] using ids a tool returned this run; never invent an id or a quote. Restricted details show as "[restricted]" or counts: say "restricted to <team>", never guess them. Do not propose anything: you only report. If a tool says nothing is connected, say so plainly.`,
});
