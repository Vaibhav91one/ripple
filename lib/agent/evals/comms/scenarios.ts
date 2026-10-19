// Comms Planner eval set. d-1 (API v1 sunset, Jan 31 2027) reaches Sales and Support (told) and DevRel, Legal, Security (the gap), with a contract conflict.
import type { Scenario } from "../run";

const CHANGE = Math.floor(Date.parse("2027-01-31T09:00:00Z") / 1000); // SUNSETS.on of d-1
const DAY = 86400;
const NEVER: Scenario["expect"]["mustNotPropose"] = ["send_email", "send_slack", "pr_comment", "graph_merge", "create_issue", "create_task", "draft_doc", "slack_channel_create", "slack_post", "access_request"];
const team = (teamId: string, ownerId: string, leadDays: number, briefNeeded: boolean) => ({ teamId, ownerId, dueAt: CHANGE - leadDays * DAY, briefNeeded });
const report = (teams: object[]) => ({ summary: "Five teams are affected by the API v1 shutdown on Jan 31, 2027; Legal is due first, and a shared channel is needed because of the contract conflict.", teams, channel: "chg-sunset-api-v1-on-jan-31" });
const row = (teamId: string, ownerId: string, dueDate: string, briefNeeded: boolean) => ({ teamId, ownerId, dueDate, briefNeeded, accessNeeded: 0 });

export const commsScenarios: Scenario[] = [
  {
    name: "d-1: a campaign per team with owners, due dates before the change, and a shared channel because of the conflict",
    input: { reason: "change.confirmed", decisionId: "d-1" },
    expect: {
      mustCite: [],
      mustPropose: [{
        kind: "campaign_plan",
        // teams are sorted by id: devrel, legal, sales, security, support
        match: {
          decisionId: "d-1", changeDate: CHANGE, channel: { name: "chg-sunset-api-v1-on-jan-31", reason: "both" },
          teams: { 0: team("devrel", "p-maya", 14, true), 1: team("legal", "p-mei", 30, true), 2: { teamId: "sales", briefNeeded: false }, 3: team("security", "p-tara", 21, true) },
        },
      }],
      mustNotPropose: NEVER, proposalCount: 1, maxSteps: 4,
    },
    trace: {
      calls: [[{ tool: "campaign_preview", input: { decisionId: "d-1" } }], [{ tool: "propose_campaign_plan", input: { decisionId: "d-1" } }]],
      output: report([row("devrel", "p-maya", "2027-01-17", true), row("legal", "p-mei", "2027-01-01", true), row("security", "p-tara", "2027-01-10", true)]),
    },
  },
  {
    name: "unknown decision: nothing is proposed",
    input: { reason: "manual", decisionId: "d-nope" },
    expect: { mustCite: [], mustPropose: [], mustNotPropose: [...NEVER, "campaign_plan"], maxSteps: 3 },
    trace: {
      calls: [[{ tool: "campaign_preview", input: { decisionId: "d-nope" } }]],
      output: { summary: "No such change, so there is nothing to plan.", teams: [], channel: null },
    },
  },
];
