// Customer Exposure: which customers actually use what a change touches, and which deals and renewals are at risk.
// Serves Sales and CS. Writes only drafts (customer email, talk track), and a person approves each; it never sends.
import { z } from "zod";
import { defineAgent } from "../define";

export const ExposureReport = z.object({
  summary: z.string().describe("Two sentences for Sales and CS, citing [[artifact-id]] from tool results"),
  customers: z.array(z.object({
    customerId: z.string(),
    name: z.string(),
    calls30d: z.number().nullable().describe("Calls in the last 30 days; null when the usage import has none"),
    arr: z.number().nullable().describe("ARR exactly as the tool returned it; null when the tool withheld it. Never estimate."),
    lastSeen: z.string().nullable().describe("YYYY-MM-DD, or null"),
    stale: z.boolean().describe("True when the usage row was last seen more than 90 days ago"),
  })).describe("Ranked by usage, then ARR, highest first"),
  atRisk: z.array(z.object({
    kind: z.enum(["deal", "renewal"]),
    id: z.string(),
    name: z.string(),
    amount: z.number().nullable(),
    why: z.string().describe("What was promised or guaranteed, citing [[artifact-id]]"),
  })),
  proposed: z.array(z.string()).describe("Titles of the drafts you proposed this run"),
});

export const exposure = defineAgent({
  name: "exposure",
  group: "understand",
  team: "sales",
  model: "reasoning",
  tools: ["ripple", "deals_at_risk", "customer_usage", "search", "propose_customer_draft"],
  writes: ["draft_doc"],
  budget: { maxSteps: 8, maxTokens: 70_000 },
  trigger: { events: ["change.confirmed"] },
  input: z.object({
    reason: z.string().describe("What started the run: change.confirmed or manual"),
    decisionId: z.string().nullable(),
  }),
  output: ExposureReport,
  system: ({ now }) => `You are Customer Exposure, working for Sales and CS. Today is ${new Date(now * 1000).toISOString().slice(0, 10)}.
The input names a decision id. Work in this order, one tool call per step:
1. ripple for the decision: what it touches and the conflicts (contracts that guarantee what is being changed).
2. customer_usage: who really uses it. Keep the order the tool returned (usage, then ARR). Copy calls30d, arr and lastSeen exactly; a row marked stale or without calls30d means the usage data is old or missing, say so.
3. deals_at_risk: open deals that were promised the thing being changed, with the verbatim promise.
4. For the top customers by usage (at most three) propose_customer_draft: kind "email" to the customer, and kind "talk_track" for the account owner. Quote what the sources say; do not put ARR figures in a draft.
Rules: cite every claim as [[artifact-id]] using ids a tool returned this run; never invent a customer, number or promise. If a tool shows ARR or deal text as restricted or null, report it as restricted and do not guess it. You never send anything to a customer: no email, no Slack. Drafts are for a person to read and approve.`,
});
