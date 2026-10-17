// Ask eval set, converted from lib/eval questions (the ones a tool answers directly). The trace is the tool path
// the deterministic query wrappers use; mustCite is the source list each question names there.
import { contractScenarios } from "../contract/scenarios";
import { injectionScenarios } from "../injection";
import type { Scenario } from "../run";

const ask = (name: string, question: string, calls: { tool: string; input: object }[], answer: string, mustCite: string[]): Scenario => ({
  name, input: { question },
  expect: { mustCite, mustPropose: [], mustNotPropose: ["create_task", "graph_merge", "send_slack", "send_email"], maxSteps: 5 },
  trace: { calls: [calls], output: { answer } },
});

export const askScenarios: Scenario[] = [
  ask("who knows the v1 auth flow", "Who knows the v1 auth flow best?", [{ tool: "who_knows", input: { systemId: "api-v1" } }],
    "Priya knows it best: she wrote the v1 handlers [[pr-v1-1]] and [[pr-v1-9]].", ["pr-v1-1", "pr-v1-9"]),
  ask("v1 sunset gap", "What is the gap for the v1 sunset (teams hit but never told)?", [{ tool: "ripple", input: { decisionId: "d-1" } }],
    "DevRel [[art-sdk-docs]], Legal [[art-msa-northwind]] and Security [[art-auth-design]] are hit but were never told.", ["art-sdk-docs", "art-msa-northwind", "art-auth-design"]),
  ask("contracts past the sunset", "Which contracts still promise v1 past the sunset?", [{ tool: "ripple", input: { decisionId: "d-1" } }],
    "ctr-1 [[art-msa-northwind]] and ctr-2 [[art-msa-halden]] still promise v1.", ["art-msa-northwind", "art-msa-halden"]),
  ask("why security is in the ripple", "Why is Security in the ripple?", [{ tool: "why_affected", input: { decisionId: "d-1", teamId: "security" } }],
    "Security owns auth-service, which depends on API v1 [[art-auth-design]].", ["art-auth-design"]),
  ask("full-text search", "Which artifact mentions Northwind?", [{ tool: "search", input: { text: "Northwind" } }],
    "The Northwind MSA mentions it [[art-msa-northwind]].", ["art-msa-northwind"]),
  ask("bottleneck needs no citation", "Which team blocks the most open requests?", [{ tool: "bottleneck", input: {} }],
    "Legal blocks the most open requests.", []),
  ask("critical systems (PageRank)", "Which systems would hurt most if changed?", [{ tool: "critical_systems", input: { limit: 5 } }],
    "API v1 is the most critical system: the most others depend on it. auth-service and api-gateway follow.", []),
  ask("team clusters (WCC)", "Which teams always change together?", [{ tool: "team_clusters", input: {} }],
    "Legal and Sales sit in one cluster with Eng and DevRel: their contracts and deals all hang on API v1.", []),
  ask("weighted path", "What is the cheapest path from d-1 to Legal?", [{ tool: "weighted_path", input: { decisionId: "d-1", teamId: "legal" } }],
    "d-1 reaches Legal in three hops: the decision sunsets API v1, which a Legal-managed contract guarantees [[art-rfc14]].", ["art-rfc14"]),
  ask("unknown system answers honestly", "Who is affected if we sunset the fax-gateway service?", [{ tool: "who_knows", input: { systemId: "fax-gateway" } }],
    "The graph has nothing on fax-gateway; the dependency may not be modelled.", []),
  {
    // Hand-off: Ask runs the Contract Sentinel inline. The Sentinel's drafts and tasks come back as previews; Ask proposes nothing itself.
    name: "hand-off: what would Contract Sentinel say about d-1",
    input: { question: "What would Contract Sentinel say about d-1?" },
    expect: { mustCite: ["art-rfc14", "art-msa-northwind", "art-msa-halden"], mustPropose: [], mustNotPropose: ["draft_doc", "create_task", "send_slack", "send_email", "graph_merge"], proposalCount: 0, maxSteps: 4 },
    nested: contractScenarios[0].trace,
    trace: {
      calls: [[{ tool: "list_agents", input: {} }], [{ tool: "run_agent", input: { name: "contract", input: { reason: "manual", decisionId: "d-1", contractId: null } } }]],
      output: { answer: "Contract Sentinel flags clause 7.2 in two contracts, Northwind [[art-msa-northwind]] and Halden [[art-msa-halden]], which guarantee API v1 until 2027-06-30, past the Jan 31 shutdown [[art-rfc14]]. It also drafted notices and review tasks; those are previews, nothing was created or sent." },
    },
  },
  ask("list the agents", "Which agents can you run for me?", [{ tool: "list_agents", input: {} }],
    "I can run impact, contract, exposure, access and digest. Contract, exposure and access would write, so they return previews only.", []),
  // Answer validation (#211): the mock model invents; the answer must be rejected and replaced from the rows.
  {
    name: "rejected: names a team that is not in the rows",
    input: { question: "Who is affected by the v1 sunset?" },
    expect: { mustCite: [], mustPropose: [], mustNotPropose: [], maxSteps: 3, rejected: { outcome: "path" } },
    trace: { calls: [[{ tool: "ripple", input: { decisionId: "d-1" } }]], output: { answer: "Leadership is affected by the v1 sunset [[art-msa-northwind]]." } },
  },
  {
    name: "rejected: an empty traversal answered with no impact",
    input: { question: "What is the impact of the fax gateway retirement?" },
    graphFixture: { statements: ["CREATE (:Decision {id: 'd-empty', title: 'Retire the fax gateway', status: 'decided', decidedAt: 1760000000, fixture: true})"] },
    expect: { mustCite: [], mustPropose: [], mustNotPropose: [], maxSteps: 3, rejected: { outcome: "not_in_graph" } },
    trace: { calls: [[{ tool: "ripple", input: { decisionId: "d-empty" } }]], output: { answer: "Nothing is affected: there is no impact, it is safe to retire." } },
  },
  ...injectionScenarios((question) => ({ question }), (answer) => ({ answer })),
];
