// Digest: one calm weekly summary per person (their digest day, 08:00 in their time zone). Read-only; the worker delivers it as digest.weekly.
// Output schema is OpenAI-strict: every key required, optional values are .nullable().
import { z } from "zod";
import { defineAgent } from "../define";

const Item = z.object({ decisionId: z.string(), note: z.string().describe("One sentence citing [[artifact-id]]") });

export const DigestReport = z.object({
  summary: z.string().describe("Two sentences for this person, citing [[artifact-id]]"),
  changed: z.array(Item.extend({ title: z.string() })).describe("Changes that are open or moved this week"),
  hitsYourTeam: z.array(Item).describe("Changes that affect the person's team"),
  waitingOnYou: z.array(Item).describe("Changes the person's team was never told about or has not acknowledged"),
  atRisk: z.array(Item.extend({ kind: z.enum(["gap", "conflict", "deal"]) })).describe("Teams never told, contract conflicts, deals promised what is changing"),
  leadership: z.object({
    openChanges: z.number(), gaps: z.number(), conflicts: z.number(),
    decisionsNeeded: z.array(z.string()).describe("Decisions leadership must make, citing [[artifact-id]]"),
  }).nullable().describe("Only when teamId is leadership, otherwise null"),
});

export const digest = defineAgent({
  name: "digest",
  displayName: "Daily Digest",
  tagline: "One calm summary of what changed and what is waiting for you.",
  group: "understand",
  team: "everyone",
  model: "reasoning",
  tools: ["recall", "list_decisions", "ripple", "trace_decision", "search"],
  writes: [],
  budget: { maxSteps: 8, maxTokens: 50_000 },
  // hourly: the worker's digest tick enqueues a run only for people whose local time is their digest day, 08:00-08:59
  trigger: { cron: "0 * * * *" },
  input: z.object({ personId: z.string(), teamId: z.string().nullable(), weekStart: z.string().describe("YYYY-MM-DD, the person's local date") }),
  output: DigestReport,
  system: ({ now }) => `You are the weekly Digest for one person. Today is ${new Date(now * 1000).toISOString().slice(0, 10)}.
The input names the person, their team and the week. Work in this order, one tool call per step:
1. list_decisions, to see every change and its status.
2. ripple for each decision that is not closed (at most four): the teams it hits, the gap (teams never told) and the conflicts.
3. trace_decision or search only when a note needs the document behind it.
Then fill: changed (open changes), hitsYourTeam (the decision hits the person's team), waitingOnYou (the person's team is in the gap), atRisk (each team in the gap as kind "gap", each contract conflict as "conflict", deals as "deal").
If teamId is "leadership", also fill leadership with the counts of open changes, gaps and conflicts and the decisions that need a call; otherwise leadership is null.
Rules: calm and short, no alarm words. Cite every claim as [[artifact-id]] using ids a tool returned this run; never invent an id or a quote. Restricted details show as counts or "[restricted]": say "restricted to <team>" and never guess them. You only report; you cannot send or change anything.`,
});
