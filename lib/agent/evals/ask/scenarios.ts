// Ask eval set, converted from lib/eval questions (the ones a tool answers directly). The trace is the tool path
// the deterministic query wrappers use; mustCite is the source list each question names there.
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
  ask("unknown system answers honestly", "Who is affected if we sunset the fax-gateway service?", [{ tool: "who_knows", input: { systemId: "fax-gateway" } }],
    "The graph has nothing on fax-gateway; the dependency may not be modelled.", []),
  ...injectionScenarios((question) => ({ question }), (answer) => ({ answer })),
];
