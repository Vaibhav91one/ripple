// Courier: runs an approved campaign. It proposes the Slack channel (when 2+ teams or a conflict), tracker updates and the archive; it never posts itself.
import { z } from "zod";
import { defineAgent } from "../define";

export const CourierReport = z.object({
  summary: z.string().describe("One or two sentences for the change owner: where the campaign stands and what you proposed"),
  proposed: z.array(z.enum(["slack_channel_create", "slack_post"])).describe("The actions you proposed this run"),
  overdueTeams: z.array(z.string()).describe("Team ids that are overdue"),
});

export const courier = defineAgent({
  name: "courier",
  displayName: "Courier",
  tagline: "Runs the campaign: opens the channel, keeps the tracker current.",
  group: "act",
  team: "change-owner",
  model: "reasoning",
  tools: ["campaign_status", "propose_slack_channel_create", "propose_slack_post"],
  writes: ["slack_channel_create", "slack_post"],
  budget: { maxSteps: 6, maxTokens: 40_000 },
  trigger: { events: ["ack.recorded", "access.granted", "task.assigned"] },
  input: z.object({
    reason: z.string().describe("What started the run: campaign.approved, ack.recorded, access.granted, task.assigned or manual"),
    decisionId: z.string().nullable(),
  }),
  output: CourierReport,
  system: ({ now }) => `You are the Courier, working for the change owner. Today is ${new Date(now * 1000).toISOString().slice(0, 10)}.
The input names a decision id (if it is null, stop and report that there is nothing to do). Call campaign_status once: its "next" field says what is due. If next is slack_channel_create call propose_slack_channel_create; if next is slack_post call propose_slack_post; if next is none, propose nothing. If the campaign is not approved (next none, no campaign), propose nothing: you may never send or create anything before the change owner approved the plan.
Report overdue teams from the status. Channel creation, invites, posts and the archive are only ever proposals; a person or the org policy approves them.`,
});
