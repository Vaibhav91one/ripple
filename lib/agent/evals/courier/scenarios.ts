// Courier eval set. The graph fixture stands in for what an approved campaign_plan writes (Campaign nodes only exist after approval).
import type { Scenario } from "../run";

const NEVER: Scenario["expect"]["mustNotPropose"] = ["send_email", "send_slack", "pr_comment", "graph_merge", "create_issue", "create_task", "draft_doc", "access_request", "campaign_plan"];
const camp = (extra: string) => ({ statements: [`CREATE (:Campaign {id: 'camp-d-1', decisionId: 'd-1', status: 'active', channelName: 'chg-sunset-api-v1-on-jan-31', owner: 'p-priya', fixture: true${extra}})`] });
const status = () => [{ tool: "campaign_status", input: { decisionId: "d-1" } }];
const report = (summary: string, proposed: ("slack_channel_create" | "slack_post")[]) => ({ summary, proposed, overdueTeams: [] });

export const courierScenarios: Scenario[] = [
  {
    name: "approved campaign, no channel yet: proposes the channel",
    graphFixture: camp(""),
    input: { reason: "campaign.approved", decisionId: "d-1" },
    expect: { mustCite: [], mustPropose: [{ kind: "slack_channel_create", match: { decisionId: "d-1", campaignId: "camp-d-1" } }], mustNotPropose: [...NEVER, "slack_post"], proposalCount: 1, maxSteps: 4 },
    trace: { calls: [status(), [{ tool: "propose_slack_channel_create", input: { decisionId: "d-1" } }]], output: report("The campaign is approved and spans five teams; I proposed the change channel.", ["slack_channel_create"]) },
  },
  {
    name: "not approved: nothing is proposed even if the model tries",
    graphFixture: { statements: ["RETURN 1"] }, // clears the previous scenario's Campaign
    input: { reason: "ack.recorded", decisionId: "d-1" },
    expect: { mustCite: [], mustPropose: [], mustNotPropose: [...NEVER, "slack_channel_create", "slack_post"], maxSteps: 4 },
    trace: { calls: [status(), [{ tool: "propose_slack_channel_create", input: { decisionId: "d-1" } }, { tool: "propose_slack_post", input: { decisionId: "d-1" } }]], output: report("The change owner has not approved a campaign yet, so I proposed nothing.", []) },
  },
  {
    name: "channel exists and the tracker is stale: proposes a tracker update",
    graphFixture: camp(", channelId: 'C0CHG1', trackerTs: '1.1', trackerHash: 'stale'"),
    input: { reason: "ack.recorded", decisionId: "d-1" },
    expect: { mustCite: [], mustPropose: [{ kind: "slack_post", match: { decisionId: "d-1", op: "tracker" } }], mustNotPropose: [...NEVER, "slack_channel_create"], proposalCount: 1, maxSteps: 4 },
    trace: { calls: [status(), [{ tool: "propose_slack_post", input: { decisionId: "d-1" } }]], output: report("A team acknowledged, so the pinned tracker needs a refresh; I proposed the update.", ["slack_post"]) },
  },
];
