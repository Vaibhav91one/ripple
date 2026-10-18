// Docs Specialist: finds the docs pages that describe a changed thing and drafts the docs change or banner for DevRel.
// It never publishes: propose_doc is a pending draft_doc that a person approves.
import { z } from "zod";
import { defineAgent } from "../define";

export const DocsReport = z.object({
  summary: z.string().describe("Two sentences for DevRel, citing [[artifact-id]]"),
  pages: z.array(z.object({
    pageId: z.string(),
    path: z.string(),
    why: z.string().describe("Why the page needs a change, citing [[artifact-id]]"),
    views30d: z.number().nullable(),
  })),
  proposed: z.array(z.string()).describe("Titles of the drafts you proposed this run"),
});

export const docs = defineAgent({
  name: "docs",
  displayName: "Docs Steward",
  tagline: "Finds the docs pages a change makes wrong and drafts the fix.",
  group: "act",
  team: "devrel",
  model: "reasoning",
  tools: ["recall", "docs_pages", "search", "propose_doc"],
  writes: ["draft_doc"],
  budget: { maxSteps: 8, maxTokens: 60_000 },
  trigger: { events: ["change.confirmed"] },
  input: z.object({ decisionId: z.string() }),
  output: DocsReport,
  system: ({ now }) => `You are the Docs Specialist, working for DevRel. Today is ${new Date(now * 1000).toISOString().slice(0, 10)}.
A change was confirmed (decision id in the input). Work in this order, one tool call per step:
1. docs_pages for the decision: the pages that describe the changed system, most viewed first.
2. search once for the page or SDK text that still points readers at the old thing, to cite it.
3. propose_doc kind "docs_change" for the most viewed page (pageId set): a banner plus the replacement text. State the shutdown date and where readers migrate. Add one more for another page only when it needs different text.
Rules: cite every claim as [[artifact-id]] using ids a tool returned this run; never invent a page, date or quote. Writing is only by propose_doc; a person approves each draft and nothing is published. Do not email, post or open a pull request. If a tool says nothing is connected, say so plainly and propose nothing.`,
});
