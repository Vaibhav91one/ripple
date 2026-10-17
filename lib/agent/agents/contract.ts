// Contract Sentinel: reads contracts for Legal, finds guarantees and obligations that conflict with changes, watches renewals,
// and proposes the notice or amendment draft. It never sends: draft_doc and create_task both wait for approval.
import { z } from "zod";
import { defineAgent } from "../define";

export const ContractReport = z.object({
  summary: z.string().describe("Two sentences for Legal, citing [[artifact-id]]"),
  conflicts: z.array(z.object({
    contractId: z.string(),
    customer: z.string().nullable(),
    clause: z.string().describe("Clause number, e.g. 7.2"),
    quote: z.string().describe("The clause text, verbatim from the tool result"),
    conflictsWith: z.string().describe("The change it collides with, citing [[artifact-id]]"),
    severity: z.enum(["low", "medium", "high"]),
  })),
  obligations: z.array(z.object({
    contractId: z.string(),
    clause: z.string(),
    what: z.string().describe("What Ledgerly owes, citing [[artifact-id]]"),
    dueAt: z.string().nullable().describe("YYYY-MM-DD, or null when there is no date"),
  })),
  renewals: z.array(z.object({ contractId: z.string(), endsAt: z.string().describe("YYYY-MM-DD"), noticeDays: z.number().nullable() })),
  proposed: z.array(z.string()).describe("Titles of the drafts and tasks you proposed this run"),
});

export const contract = defineAgent({
  name: "contract",
  group: "understand",
  team: "legal",
  model: "reasoning",
  tools: ["recall", "contract_conflicts", "contract_clauses", "contract_renewals", "search", "propose_draft", "propose_task"],
  writes: ["draft_doc", "create_task"],
  budget: { maxSteps: 10, maxTokens: 80_000 },
  trigger: { events: ["contract.added", "change.confirmed"], cron: "0 6 * * *" },
  input: z.object({
    reason: z.string().describe("What started the run: contract.added, change.confirmed, cron or manual"),
    decisionId: z.string().nullable(),
    contractId: z.string().nullable(),
  }),
  output: ContractReport,
  system: ({ now }) => `You are the Contract Sentinel, working for Legal. Today is ${new Date(now * 1000).toISOString().slice(0, 10)}.
Depending on the input:
- decisionId set (a change was confirmed): contract_conflicts for it, then contract_clauses for each contract it names. Report each conflict with the clause number and the clause text verbatim. For each conflict propose_draft (kind "notice" to the customer, or "amendment") quoting the clause, and propose_task for team "legal" to review it.
- contractId set (a contract was added): contract_clauses for it. List obligations with due dates and anything about API versions. No draft unless a clause collides with a known change.
- reason "cron" (renewal watch): contract_renewals with withinDays 90, report them, and propose_task for each contract whose notice window is already open.
One tool call per step. Rules: cite every claim as [[artifact-id]] using ids a tool returned this run; never invent a clause or a quote. If clause text shows as "[restricted]", say it is restricted and stop: do not guess. Writing is only by propose_draft and propose_task; a person approves each. You never send anything to anyone: no email, no Slack, no "notify the customer" step. Drafts are for Legal to read.`,
});
