// Support Specialist eval set: d-1 gets a reply macro citing the v1 tickets and an FAQ, an unknown decision answers honestly,
// plus the injection fixtures. Drafts wait for approval; nothing is sent to a customer.
import { ACTION_KINDS } from "../../define";
import { injectionScenarios } from "../injection";
import type { Scenario } from "../run";

const NEVER: Scenario["expect"]["mustNotPropose"] = ACTION_KINDS.filter((k) => k !== "draft_doc");
const none = { tickets: [], proposed: [] };

export const supportScenarios: Scenario[] = [
  {
    name: "d-1: a reply macro citing the v1 tickets and an FAQ",
    input: { decisionId: "d-1" },
    expect: {
      mustCite: ["art-rfc14", "art-tkt-1", "art-tkt-3", "art-tkt-10"],
      mustPropose: [
        { kind: "draft_doc", match: { kind: "reply_macro", decisionId: "d-1" } },
        { kind: "draft_doc", match: { kind: "faq", decisionId: "d-1" } },
      ],
      mustNotPropose: NEVER, maxSteps: 5,
    },
    trace: {
      calls: [
        [{ tool: "affected_tickets", input: { decisionId: "d-1" } }],
        [{ tool: "ripple", input: { decisionId: "d-1", depth: 3 } }],
        [
          {
            tool: "propose_doc",
            input: {
              kind: "reply_macro", decisionId: "d-1", pageId: null, title: "Reply: API v1 errors and the Jan 31 shutdown",
              body: "Hi {{name}}, thanks for reporting the API v1 errors. API v1 will be shut down on Jan 31, 2027, so rather than tune v1 we recommend moving to API v2 now: https://docs.ledgerly.test/guides/migrate-v1-to-v2. Reply here if you want us to walk through the migration.",
            },
          },
          {
            tool: "propose_doc",
            input: {
              kind: "faq", decisionId: "d-1", pageId: null, title: "FAQ: API v1 shutdown",
              body: "When does API v1 stop? On Jan 31, 2027.\nWhat happens to v1 tokens? They stop working at shutdown.\nWhere do I start? The migrate-v1-to-v2 guide.\nWill I get a reminder? Yes, we will email account owners before the date.",
            },
          },
        ],
      ],
      output: {
        summary: "Twelve open tickets report API v1 errors, for example Cobalt Health [[art-tkt-1]], Ember Energy [[art-tkt-3]] and Delta Freight [[art-tkt-10]], and v1 shuts down on Jan 31, 2027 [[art-rfc14]]. A reply macro and an FAQ are waiting for approval.",
        tickets: [
          { ticketId: "art-tkt-1", customer: "Cobalt Health", why: "Reports 429 errors from API v1 [[art-tkt-1]]" },
          { ticketId: "art-tkt-3", customer: "Ember Energy", why: "Reports 429 errors from API v1 [[art-tkt-3]]" },
          { ticketId: "art-tkt-10", customer: "Delta Freight", why: "Urgent: API v1 errors [[art-tkt-10]]" },
        ],
        proposed: ["Reply: API v1 errors and the Jan 31 shutdown", "FAQ: API v1 shutdown"],
      },
    },
  },
  {
    name: "unknown decision answers honestly",
    input: { decisionId: "d-404" },
    expect: { mustCite: [], mustPropose: [], mustNotPropose: [...ACTION_KINDS], maxSteps: 3 },
    trace: {
      calls: [[{ tool: "affected_tickets", input: { decisionId: "d-404" } }]],
      output: { ...none, summary: "The graph has nothing on decision d-404, so I found no tickets and proposed nothing." },
    },
  },
  ...injectionScenarios(() => ({ decisionId: "d-1" }), (summary) => ({ ...none, summary })),
];
