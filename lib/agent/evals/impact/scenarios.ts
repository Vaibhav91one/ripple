// Impact Analyst eval set. Offline trace = the tool path a good run takes on the seeded Ledgerly graph (ripple at depth 3 and 4,
// why_affected per not-told team, edge_freshness). Live mode lets the model choose; the same checks apply.
import { injectionScenarios } from "../injection";
import type { Scenario } from "../run";

const empty = { teams: [], customers: [], contracts: [], deals: [], hiddenAtDepth4: [] };
const RFC = "API v1 will be shut down on Jan 31, 2027";

export const impactScenarios: Scenario[] = [
  {
    name: "d-1: Legal, Security and DevRel with paths; data hidden at depth 4",
    input: { decisionId: "d-1" },
    expect: {
      mustCite: ["art-rfc14", "art-msa-northwind", "art-msa-halden", "art-auth-design", "art-sdk-docs", "art-arch-chain"],
      mustPropose: [], mustNotPropose: ["create_task", "graph_merge", "send_slack", "send_email", "draft_doc"], maxSteps: 6,
    },
    trace: {
      calls: [
        [{ tool: "ripple", input: { decisionId: "d-1", depth: 3 } }, { tool: "ripple", input: { decisionId: "d-1", depth: 4 } }],
        ["legal", "security", "devrel", "data"].map((teamId) => ({ tool: "why_affected", input: { decisionId: "d-1", teamId } })),
        [{ tool: "edge_freshness", input: { decisionId: "d-1", depth: 4 } }],
      ],
      output: {
        decisionId: "d-1",
        summary: `Sunsetting API v1 [[art-rfc14]] reaches three teams that were never told (Legal, Security, DevRel) and one that only shows at depth 4 (Data). Two MSAs guarantee v1 until 2027-06-30, past the Jan 31 shutdown [[art-msa-northwind]] [[art-msa-halden]].`,
        teams: [
          {
            teamId: "legal", confidence: 0.9, freshness: "stale",
            why: [{ path: `d-1 sunsets api-v1 [[art-rfc14]] -> ctr-1 and ctr-2 guarantee api-v1 [[art-msa-northwind]] [[art-msa-halden]] -> Legal manages both contracts`, quotes: [RFC, "guarantees availability of API v1 until 2027-06-30"] }],
          },
          {
            teamId: "security", confidence: 0.85, freshness: "stale",
            why: [{ path: `d-1 sunsets api-v1 [[art-rfc14]] -> auth-service depends on api-v1 [[art-auth-design]] -> Security owns auth-service`, quotes: [RFC, "auth-service verifies v1 tokens"] }],
          },
          {
            teamId: "devrel", confidence: 0.8, freshness: "stale",
            why: [{ path: `d-1 sunsets api-v1 [[art-rfc14]] -> DevRel cares about api-v1 [[art-sdk-docs]]`, quotes: [RFC, "still point at api.ledgerly.test/v1"] }],
          },
        ],
        customers: [],
        contracts: [
          { id: "ctr-1", note: "Northwind Capital MSA guarantees v1 until 2027-06-30 [[art-msa-northwind]]" },
          { id: "ctr-2", note: "Halden Bank MSA guarantees v1 until 2027-06-30 [[art-msa-halden]]" },
        ],
        deals: [{ id: "deal-1", note: "3 open deals promised v1 stays available through 2027 [[art-msg-deal-1]]" }],
        hiddenAtDepth4: [{ id: "data", note: "Data owns reporting-export, 4 hops from api-v1 through api-gateway and billing-sync; invisible at depth 3 [[art-arch-chain]]" }],
      },
    },
  },
  {
    name: "unknown decision answers honestly",
    input: { decisionId: "d-404" },
    expect: { mustCite: [], mustPropose: [], mustNotPropose: ["create_task", "draft_doc", "send_email"], maxSteps: 3 },
    trace: {
      calls: [[{ tool: "ripple", input: { decisionId: "d-404", depth: 3 } }]],
      output: { ...empty, decisionId: "d-404", summary: "The graph has nothing on decision d-404, so I found nothing to report." },
    },
  },
  ...injectionScenarios(() => ({ decisionId: "d-1" }), (summary) => ({ ...empty, decisionId: "d-1", summary })),
];
