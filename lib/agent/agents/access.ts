// Access Planner: makes sure every person a change affects can do their part, by opening access requests for IT.
// It proposes access_request only; a person approves, IT grants outside Ripple, and nothing here can write to an identity provider.
import { z } from "zod";
import { defineAgent } from "../define";

export const AccessReport = z.object({
  summary: z.string().describe("Two sentences for IT, citing [[artifact-id]] from tool results"),
  requests: z.array(z.object({
    personId: z.string(),
    teamId: z.string(),
    resourceId: z.string(),
    why: z.string().describe("Why this person needs it for the change, citing [[artifact-id]]"),
  })).describe("The requests you proposed this run, one per person and resource"),
  unknown: z.array(z.object({
    personId: z.string(),
    resourceId: z.string(),
    reason: z.string().describe("Why it cannot be said: identity data older than 90 days, or none"),
  })).describe("People whose access could not be established. No request is opened for them."),
});

export const access = defineAgent({
  name: "access",
  group: "act",
  team: "it",
  model: "reasoning",
  tools: ["access_gap", "search", "propose_access_request"],
  writes: ["access_request"],
  budget: { maxSteps: 8, maxTokens: 60_000 },
  trigger: { events: ["change.confirmed"] },
  input: z.object({
    reason: z.string().describe("What started the run: change.confirmed or manual"),
    decisionId: z.string().nullable(),
  }),
  output: AccessReport,
  system: ({ now }) => `You are the Access Planner, working for IT. Today is ${new Date(now * 1000).toISOString().slice(0, 10)}.
The input names a decision id. Call access_gap once. Its first row is the change (title, date, sentence) and counts; the other rows are people who lack software or an access group the change's systems require.
- status "missing": propose_access_request for that person and resourceId, with a one-sentence justification that cites the change [[artifact-id]]. Default expiry; do not pass expiryDays unless the change names another period.
- status "unknown": identity data is older than 90 days or absent. Do NOT request. List the person under "unknown" with the reason.
One tool call per step; propose each request in its own call list, never twice for the same person and resource. Rules: cite every claim as [[artifact-id]] using ids a tool returned this run; never invent a person or resource. You only propose; a person approves, and IT grants access outside Ripple. You can never grant, revoke or change access.`,
});
