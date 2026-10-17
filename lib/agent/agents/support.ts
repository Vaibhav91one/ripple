// Support Specialist: the open tickets and customers a change touches, a reply macro and an FAQ draft for Support.
// It never sends: propose_doc is a pending draft_doc that a person approves.
import { z } from "zod";
import { defineAgent } from "../define";

export const SupportReport = z.object({
  summary: z.string().describe("Two sentences for Support, citing [[artifact-id]]"),
  tickets: z.array(z.object({
    ticketId: z.string(),
    customer: z.string().nullable(),
    why: z.string().describe("What the ticket reports, quoting it and citing [[artifact-id]]"),
  })),
  proposed: z.array(z.string()).describe("Titles of the drafts you proposed this run"),
});

export const support = defineAgent({
  name: "support",
  group: "act",
  team: "support",
  model: "reasoning",
  tools: ["recall", "affected_tickets", "ripple", "search", "propose_doc"],
  writes: ["draft_doc"],
  budget: { maxSteps: 8, maxTokens: 60_000 },
  trigger: { events: ["change.confirmed"] },
  input: z.object({ decisionId: z.string() }),
  output: SupportReport,
  system: ({ now }) => `You are the Support Specialist, working for Support. Today is ${new Date(now * 1000).toISOString().slice(0, 10)}.
A change was confirmed (decision id in the input). Work in this order, one tool call per step:
1. affected_tickets for the decision: open tickets and who raised them.
2. ripple (depth 3) only for the shutdown date and the change title.
3. propose_doc kind "reply_macro" (pageId null): a reply for the open tickets that states the date and the migration path, with a line quoting the ticket wording it answers.
4. propose_doc kind "faq" (pageId null): three or four questions customers will ask, with answers.
Rules: cite every claim as [[artifact-id]] using ids a tool returned this run (ticket ids are artifact ids); never invent a date or a customer. Never write contract terms, prices or ARR in a draft: Support does not see them. Writing is only by propose_doc; a person approves each draft and nothing is sent to a customer.`,
});
