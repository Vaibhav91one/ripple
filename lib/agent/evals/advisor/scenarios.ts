// Decision Advisor eval set: on the d-1 conflict, four options with graph-derived costs (including $180k ARR at risk),
// no writes; an unknown decision answers honestly; plus the injection fixtures.
import { ACTION_KINDS } from "../../define";
import { injectionScenarios } from "../injection";
import type { Scenario } from "../run";

const none = { options: [], recommendation: null, proposed: [] };
const cost = (arrAtRisk: number | null, customers: number, teams: number, tasks: number) => ({ arrAtRisk, customers, teams, tasks });

export const advisorScenarios: Scenario[] = [
  {
    name: "d-1: four options with costs, $180k at risk, no writes",
    input: { decisionId: "d-1", chosen: null },
    expect: { mustCite: ["art-rfc14", "art-msa-northwind", "art-msa-halden"], mustPropose: [], mustNotPropose: [...ACTION_KINDS], maxSteps: 4 },
    trace: {
      calls: [[{ tool: "decision_costs", input: { decisionId: "d-1" } }], [{ tool: "contract_conflicts", input: { decisionId: "d-1" } }]],
      output: {
        decisionId: "d-1",
        summary: "The Jan 31, 2027 shutdown [[art-rfc14]] collides with two MSAs that guarantee API v1 until 2027-06-30 [[art-msa-northwind]] [[art-msa-halden]], $180,000 of ARR.",
        options: [
          { kind: "move_date", title: "Move the shutdown to 2027-07-01", description: "Push the date past both guarantees [[art-msa-northwind]] [[art-msa-halden]]; every v1 customer gets more time [[art-rfc14]].", cost: cost(0, 40, 5, 6) },
          { kind: "grandfather", title: "Grandfather Northwind and Halden", description: "Keep the two guaranteed customers on v1 until 2027-06-30 and shut down for everyone else on Jan 31 [[art-msa-northwind]] [[art-msa-halden]].", cost: cost(0, 2, 5, 7) },
          { kind: "amend_contract", title: "Amend clause 7.2 with both customers", description: "Negotiate the v1 guarantee down to the shutdown date before Jan 31 [[art-msa-northwind]] [[art-msa-halden]].", cost: cost(180000, 2, 2, 8) },
          { kind: "accept_breach", title: "Shut down on time and accept the breach", description: "Hold the date [[art-rfc14]] and breach clause 7.2 for both customers [[art-msa-northwind]] [[art-msa-halden]].", cost: cost(180000, 2, 5, 6) },
        ],
        recommendation: "Grandfather the two customers: it keeps the Jan 31 date for the other 38 customers and removes the $180,000 exposure [[art-msa-northwind]] [[art-msa-halden]].",
        proposed: [],
      },
    },
  },
  {
    name: "unknown decision answers honestly",
    input: { decisionId: "d-404", chosen: null },
    expect: { mustCite: [], mustPropose: [], mustNotPropose: [...ACTION_KINDS], maxSteps: 3 },
    trace: {
      calls: [[{ tool: "decision_costs", input: { decisionId: "d-404" } }]],
      output: { ...none, decisionId: "d-404", summary: "The graph has nothing on decision d-404, so I found no options to cost." },
    },
  },
  ...injectionScenarios(() => ({ decisionId: "d-1", chosen: null }), (summary) => ({ ...none, decisionId: "d-1", summary })),
];
