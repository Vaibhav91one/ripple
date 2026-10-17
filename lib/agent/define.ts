// defineAgent(): one validated, frozen definition per agent. Throws at definition time on unknown tools or write kinds.
import type { z } from "zod";
import { TOOLS, type ToolName } from "./tools";

export const ACTION_KINDS = ["graph_merge", "send_slack", "send_email", "pr_comment", "create_task", "create_issue", "access_request", "draft_doc"] as const;
export type ActionKind = (typeof ACTION_KINDS)[number];
export type AgentGroup = "sense" | "understand" | "act" | "ask";
export type AgentCtx = { now: number };

export type AgentDef<I extends z.ZodType = z.ZodType, O extends z.ZodType = z.ZodType> = {
  name: string;
  group: AgentGroup;
  /** Team id this agent serves. */
  /** Who the agent works for: a team id, "change-owner", or "everyone". */
  team: string;
  /** 'reasoning' -> MODEL_AGENT, 'extract' -> MODEL_EXTRACT (see roleFor in lib/llm.ts). */
  model: "reasoning" | "extract";
  tools: ToolName[];
  writes: ActionKind[];
  budget: { maxSteps: number; maxTokens: number };
  // TODO(#118): events become EventType[] from lib/events/types.ts.
  trigger: { events?: string[]; cron?: string };
  input: I;
  output: O;
  system: (ctx: AgentCtx) => string;
};

export function defineAgent<I extends z.ZodType, O extends z.ZodType>(d: AgentDef<I, O>): Readonly<AgentDef<I, O>> {
  for (const t of d.tools) if (!Object.hasOwn(TOOLS, t)) throw new Error(`agent ${d.name}: unknown tool "${t}"`);
  for (const w of d.writes) if (!(ACTION_KINDS as readonly string[]).includes(w)) throw new Error(`agent ${d.name}: unknown write kind "${w}"`);
  return Object.freeze({ ...d });
}
