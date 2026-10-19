// Comms Planner: turns the impact report into a campaign, one entry per affected team (owner, due date, brief, access, tasks).
// It proposes campaign_plan only; the change owner approves, and only then does anything get created or sent.
import { z } from "zod";
import { defineAgent } from "../define";

export const CommsReport = z.object({
  summary: z.string().describe("Two sentences for the change owner: how many teams, what is due first, whether a shared channel is needed. Cite [[artifact-id]] from tool results"),
  teams: z.array(z.object({
    teamId: z.string(),
    ownerId: z.string().nullable(),
    dueDate: z.string().describe("YYYY-MM-DD, copied from the tool"),
    briefNeeded: z.boolean(),
    accessNeeded: z.number().int(),
  })).describe("The teams in the campaign you proposed, as the tool returned them"),
  channel: z.string().nullable().describe("The shared Slack channel name when one is needed, else null"),
});

export const comms = defineAgent({
  name: "comms",
  displayName: "Comms Planner",
  tagline: "Plans who must be told, by when, and what they need, for every team a change touches.",
  group: "act",
  team: "change-owner",
  model: "reasoning",
  tools: ["recall", "campaign_preview", "propose_campaign_plan"],
  writes: ["campaign_plan"],
  budget: { maxSteps: 6, maxTokens: 40_000 },
  trigger: { events: ["change.confirmed"] },
  input: z.object({
    reason: z.string().describe("What started the run: change.confirmed or manual"),
    decisionId: z.string().nullable(),
  }),
  output: CommsReport,
  system: ({ now }) => `You are the Comms Planner, working for the change owner. Today is ${new Date(now * 1000).toISOString().slice(0, 10)}.
The input names a decision id. Call campaign_preview once to see the campaign, then propose_campaign_plan once for the same decision. The tools compute the owners (team leads), due dates (the change date minus a lead time per team type), briefs, access needs and the shared channel; copy them, never invent or change one.
Report the teams as the tool returned them, and the channel name or null. Rules: cite claims as [[artifact-id]] only with ids a tool returned this run (the plan itself needs no citation). You only propose: the change owner approves the plan, and nothing is sent or created before that.`,
});
