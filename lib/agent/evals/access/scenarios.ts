// Access Planner eval set. Fixture: the change's system REQUIRES the "v2 console" group; five Support people, everyone else holds it.
// Missing = fresh identity data and not held. Stale or absent identity data = unknown: no request. Never a grant.
import { injectionScenarios } from "../injection";
import type { Scenario } from "../run";

const NOW = Math.floor(Date.parse("2026-10-17T09:00:00Z") / 1000); // the clock evals.test.ts runs at
const DAY = 86400;
const NEVER: Scenario["expect"]["mustNotPropose"] = ["send_email", "send_slack", "pr_comment", "graph_merge", "create_issue", "create_task", "draft_doc"];
const none = { requests: [], unknown: [] };
const GROUP = "group:v2-console";

/** Support = Ana, Tomas, Nia, Hugo (seeded) + Sam. Ana, Tomas, Sam and every other team hold the group; Nia and Hugo do not, but have other identity data observed `hugoSeenDaysAgo` ago (Nia: 5 days). */
const supportFixture = (hugoSeenDaysAgo: number): string[] => [
  `CREATE (:AccessGroup {id: '${GROUP}', name: 'v2 console', fixture: true})`,
  "CREATE (:AccessGroup {id: 'group:support-desk', name: 'Support desk', fixture: true})",
  "CREATE (:Person {id: 'p-fx-sam', name: 'Sam', title: 'Support Specialist', teamId: 'support', fixture: true})",
  "MATCH (p:Person {id: 'p-fx-sam'}), (t:Team {id: 'support'}) CREATE (p)-[:MEMBER_OF]->(t)",
  `MATCH (x:System {id: 'api-v1'}), (g:AccessGroup {id: '${GROUP}'}) CREATE (x)-[:REQUIRES]->(g)`,
  `MATCH (p:Person), (g:AccessGroup {id: '${GROUP}'}) WHERE p.id IN ['p-ana', 'p-tomas', 'p-fx-sam'] OR NOT (p)-[:MEMBER_OF]->(:Team {id: 'support'}) CREATE (p)-[:HAS_ACCESS {observed_at: ${NOW - 10 * DAY}}]->(g)`,
  `MATCH (p:Person {id: 'p-nia'}), (g:AccessGroup {id: 'group:support-desk'}) CREATE (p)-[:HAS_ACCESS {observed_at: ${NOW - 5 * DAY}}]->(g)`,
  `MATCH (p:Person {id: 'p-hugo'}), (g:AccessGroup {id: 'group:support-desk'}) CREATE (p)-[:HAS_ACCESS {observed_at: ${NOW - hugoSeenDaysAgo * DAY}}]->(g)`,
];
const request = (personId: string, name: string) => ({
  tool: "propose_access_request",
  input: { decisionId: "d-1", personId, resourceId: GROUP, justification: `${name} answers v1 customers and needs the v2 console before API v1 is shut down on Jan 31, 2027.` },
});
const req = (personId: string) => ({ kind: "access_request" as const, match: { personId, resourceId: GROUP, decisionId: "d-1", teamId: "support", expiresAt: NOW + 90 * DAY, approvers: ["eng", "it"] } });
const mine = (personId: string, name: string) => ({ personId, teamId: "support", resourceId: GROUP, why: `${name} lacks the v2 console, which the change needs [[art-rfc14]]` });

export const accessScenarios: Scenario[] = [
  {
    name: "2 of 5 Support people lack the v2 console: exactly 2 requests with expiry and approvers",
    graphFixture: { statements: supportFixture(5) },
    input: { reason: "change.confirmed", decisionId: "d-1" },
    expect: { mustCite: ["art-rfc14"], mustPropose: [req("p-nia"), req("p-hugo")], mustNotPropose: NEVER, recipients: ["support"], proposalCount: 2, maxSteps: 4 },
    trace: {
      calls: [[{ tool: "access_gap", input: { decisionId: "d-1" } }], [request("p-nia", "Nia"), request("p-hugo", "Hugo")]],
      output: { summary: "API v1 will be shut down on Jan 31, 2027 [[art-rfc14]]. Two of five Support people lack the v2 console; both requests wait for approval.", requests: [mine("p-nia", "Nia"), mine("p-hugo", "Hugo")], unknown: [] },
    },
  },
  {
    name: "stale identity data is unknown, not missing: one request, one unknown",
    graphFixture: { statements: supportFixture(200) },
    input: { reason: "change.confirmed", decisionId: "d-1" },
    expect: { mustCite: ["art-rfc14"], mustPropose: [req("p-nia")], mustNotPropose: NEVER, recipients: ["support"], proposalCount: 1, maxSteps: 4 },
    trace: {
      calls: [[{ tool: "access_gap", input: { decisionId: "d-1" } }], [request("p-nia", "Nia")]],
      output: {
        summary: "One Support person lacks the v2 console [[art-rfc14]]; Hugo's identity data is 200 days old, so I opened nothing for him.",
        requests: [mine("p-nia", "Nia")],
        unknown: [{ personId: "p-hugo", resourceId: GROUP, reason: "Identity data last observed 200 days ago, older than 90 days" }],
      },
    },
  },
  {
    name: "a stale person cannot be requested even if the model tries",
    graphFixture: { statements: supportFixture(200) },
    input: { reason: "change.confirmed", decisionId: "d-1" },
    // the tool refuses (identity_data_stale), so nothing is proposed for Hugo
    expect: { mustCite: ["art-rfc14"], mustPropose: [], mustNotPropose: [...NEVER, "access_request"], maxSteps: 4 },
    trace: {
      calls: [[{ tool: "access_gap", input: { decisionId: "d-1" } }], [request("p-hugo", "Hugo")]],
      output: { summary: "Hugo's identity data is older than 90 days [[art-rfc14]], so the request was refused and nothing was opened.", requests: [], unknown: [{ personId: "p-hugo", resourceId: GROUP, reason: "Identity data older than 90 days" }] },
    },
  },
  {
    name: "nothing required: no requests",
    graphFixture: { statements: ["RETURN 1"] },
    input: { reason: "change.confirmed", decisionId: "d-1" },
    expect: { mustCite: [], mustPropose: [], mustNotPropose: [...NEVER, "access_request"], maxSteps: 3 },
    trace: {
      calls: [[{ tool: "access_gap", input: { decisionId: "d-1" } }]],
      output: { ...none, summary: "No system this change touches requires software or an access group, so nothing to request." },
    },
  },
  ...injectionScenarios(() => ({ reason: "manual", decisionId: null }), (summary) => ({ ...none, summary })),
];
