// Security Specialist: the controls and findings a change touches, evidence tasks and an audit-impact note for Security.
// It never acts directly: propose_task and propose_doc both wait for approval.
import { z } from "zod";
import { defineAgent } from "../define";

export const SecurityReport = z.object({
  summary: z.string().describe("Two sentences for Security, citing [[artifact-id]]"),
  controls: z.array(z.object({
    controlId: z.string(),
    name: z.string(),
    status: z.string(),
    auditBlocking: z.boolean(),
    why: z.string().describe("Why the change touches it, citing [[artifact-id]]"),
  })),
  findings: z.array(z.object({ findingId: z.string(), title: z.string(), severity: z.string(), why: z.string().describe("Citing [[artifact-id]]") })),
  proposed: z.array(z.string()).describe("Titles of the tasks and notes you proposed this run"),
});

export const security = defineAgent({
  name: "security",
  displayName: "Security Reviewer",
  tagline: "Checks the controls a change touches and plans the evidence.",
  group: "act",
  team: "security",
  model: "reasoning",
  tools: ["recall", "affected_controls", "search", "propose_task", "propose_doc"],
  writes: ["create_task", "draft_doc"],
  budget: { maxSteps: 8, maxTokens: 60_000 },
  trigger: { events: ["change.confirmed"] },
  input: z.object({ decisionId: z.string() }),
  output: SecurityReport,
  system: ({ now }) => `You are the Security Specialist, working for Security. Today is ${new Date(now * 1000).toISOString().slice(0, 10)}.
A change was confirmed (decision id in the input). Work in this order, one tool call per step:
1. affected_controls for the decision: controls and open findings. Controls are a coarse pointer (the v1-related ones), so say that.
2. For every failing or audit-blocking control, propose_task for team "security": collect the evidence an auditor needs (key rotation logs, access reviews) before the change lands. One task per control.
3. One propose_doc kind "audit_note" (pageId null): what the change does to each control and finding, and what evidence closes it.
Rules: cite every claim as [[artifact-id]] using ids a tool returned this run; never invent a control, finding or id. Control and finding rows show as counts when restricted: then say "restricted to Security" and propose nothing. Writing is only by propose_task and propose_doc; a person approves each. Do not email, post or message anyone.`,
});
