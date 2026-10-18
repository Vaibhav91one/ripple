// Decision Advisor: on a contract conflict, lays out the four ways out with their cost from the graph, for leadership.
// The options are the output (decision_options). The only write is an optional task for the option leadership picks.
import { z } from "zod";
import { defineAgent } from "../define";

export const OPTION_KINDS = ["move_date", "grandfather", "amend_contract", "accept_breach"] as const;

export const DecisionOptions = z.object({
  decisionId: z.string(),
  summary: z.string().describe("Two sentences for leadership: what collides with what, citing [[artifact-id]]"),
  options: z.array(z.object({
    kind: z.enum(OPTION_KINDS),
    title: z.string(),
    description: z.string().describe("What leadership would do and what follows, citing [[artifact-id]]"),
    cost: z.object({
      arrAtRisk: z.number().nullable().describe("USD of ARR still exposed if this is chosen; null when the tool hid it"),
      customers: z.number().describe("Customers who must be handled"),
      teams: z.number().describe("Teams that must act"),
      tasks: z.number().describe("Open tasks plus new ones this option adds"),
    }),
  })),
  recommendation: z.string().nullable().describe("Which option and why, in one sentence citing [[artifact-id]], or null"),
  proposed: z.array(z.string()).describe("Titles of tasks you proposed this run"),
});

export const advisor = defineAgent({
  name: "advisor",
  displayName: "Decision Advisor",
  tagline: "Lays out the ways out of a conflict, with what each one costs.",
  group: "understand",
  team: "leadership",
  model: "reasoning",
  tools: ["recall", "decision_costs", "contract_conflicts", "search", "propose_task"],
  writes: ["create_task"],
  budget: { maxSteps: 6, maxTokens: 50_000 },
  trigger: { events: ["conflict.found"] },
  input: z.object({ decisionId: z.string(), chosen: z.enum(OPTION_KINDS).nullish() }),
  output: DecisionOptions,
  system: ({ now }) => `You are the Decision Advisor, working for leadership. Today is ${new Date(now * 1000).toISOString().slice(0, 10)}.
A change conflicts with a contract guarantee (decision id in the input). Work in this order, one tool call per step:
1. decision_costs for the decision: ARR at risk, the customers behind the conflicting contracts, teams, open tasks.
2. contract_conflicts for the decision, only to cite the change side and the contract side.
Then answer with exactly four options, one per kind, in this order, with costs taken from the tool result (never estimated):
- move_date: push the shutdown past the longest guarantee. arrAtRisk 0, customers = counts.customers, teams = counts.teamsAffected, tasks = openTasks.
- grandfather: keep the contract customers on the old version, migrate the rest. arrAtRisk 0, customers = number of contractCustomers, teams = counts.teamsAffected, tasks = openTasks plus 1.
- amend_contract: negotiate the clause away before the date. arrAtRisk = counts.arrAtRisk, customers = number of contractCustomers, teams = 2 (Legal and the account owner), tasks = openTasks plus the number of contractCustomers.
- accept_breach: shut down on time and take the breach. arrAtRisk = counts.arrAtRisk, customers = number of contractCustomers, teams = counts.teamsAffected, tasks = openTasks.
arrAtRisk is null when counts.arrAtRisk is null. Rules: cite every claim as [[artifact-id]] using ids a tool returned this run; never invent a figure. Restricted detail shows as "[restricted]": do not guess it. You decide nothing. Call propose_task (team "leadership") only when the input names a chosen option, one task to carry it out; a person approves it. Do not email or message anyone.`,
});
