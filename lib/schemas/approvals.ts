// Approvals and agent runs as the screens see them (Postgres rows turned into readable shapes).
import { z } from "zod";

export const ApprovalStatus = z.enum(["pending", "approved", "rejected", "executed", "failed", "expired"]);
const Evidence = z.object({ src: z.string().optional(), quote: z.string().nullish(), confidence: z.number().optional(), structured: z.boolean().optional() });

/** What a graph proposal is about, structured, so screens can write it as a sentence with resolved names. */
export const Subject = z.object({
  op: z.enum(["merge_edge", "end_edge", "merge_node", "suggest_merge"]),
  type: z.string().optional(),
  from: z.object({ label: z.string(), id: z.string() }).optional(),
  to: z.object({ label: z.string(), id: z.string() }).optional(),
  label: z.string().optional(), id: z.string().optional(), mention: z.string().optional(),
});
export type Subject = z.infer<typeof Subject>;

export const ApprovalRow = z.object({
  id: z.string(),
  kind: z.string(),
  status: ApprovalStatus,
  /** One line: what approving does. */
  summary: z.string(),
  subject: Subject.nullable(),
  /** The payload as label/value pairs. */
  fields: z.array(z.object({ label: z.string(), value: z.string() })),
  evidence: z.array(Evidence),
  /** Agent name, or the connector/source that proposed it. */
  proposer: z.string(),
  runId: z.string().nullable(),
  /** The change (decision) it belongs to, else the source it came from. */
  changeId: z.string().nullable(),
  /** Actions sharing kind + group can be approved together. */
  group: z.string().nullable(),
  groupSize: z.number(),
  requestedAt: z.string(),
  decidedAt: z.string().nullable(),
  approver: z.string().nullable(),
  error: z.string().nullable(),
  /** The viewer's role may decide this kind. */
  canDecide: z.boolean(),
  /** suggest_merge: "same entity?" question with its two answers. */
  question: z.object({ name: z.string(), nodeId: z.string() }).nullable(),
});
export type ApprovalRow = z.infer<typeof ApprovalRow>;

export const ApprovalList = z.object({
  approvals: z.array(ApprovalRow),
  /** Pending + failed actions the viewer may decide (the sidebar badge). */
  open: z.number(),
  sample: z.boolean().optional(),
  note: z.string().optional(),
});
export type ApprovalList = z.infer<typeof ApprovalList>;

export const DecideResult = z.object({ results: z.array(z.object({ id: z.string(), status: z.string(), changed: z.boolean() })) });
export type DecideResult = z.infer<typeof DecideResult>;

export const AgentInfo = z.object({
  name: z.string(),
  group: z.string(),
  job: z.string(),
  team: z.string(),
  triggers: z.array(z.string()),
  tools: z.array(z.string()),
  writes: z.array(z.string()),
  enabled: z.boolean(),
  /** action kind -> org auto-approve flag, for the kinds this agent writes. */
  autoApprove: z.record(z.string(), z.boolean()),
  lastRun: z.object({ id: z.string(), status: z.string(), startedAt: z.string() }).nullable(),
  runs24h: z.number(),
});
export type AgentInfo = z.infer<typeof AgentInfo>;
export const AgentList = z.object({ agents: z.array(AgentInfo), canEdit: z.boolean(), sample: z.boolean().optional(), note: z.string().optional() });
export type AgentList = z.infer<typeof AgentList>;

export const RunSummary = z.object({
  id: z.string(), agent: z.string(), trigger: z.string(), status: z.string(), tokens: z.number(),
  startedAt: z.string(), durationMs: z.number().nullable(), proposals: z.number(), error: z.string().nullable(),
});
export type RunSummary = z.infer<typeof RunSummary>;
export const RunList = z.object({ runs: z.array(RunSummary), sample: z.boolean().optional(), note: z.string().optional() });
export type RunList = z.infer<typeof RunList>;

export const RunDetail = z.object({
  run: RunSummary.extend({ input: z.unknown(), output: z.unknown() }),
  steps: z.array(z.object({
    n: z.number(), kind: z.enum(["tool", "text"]), tool: z.string().nullable(), args: z.unknown(),
    cypher: z.array(z.string()), sources: z.array(z.string()), tokens: z.number(),
  })),
  proposals: z.array(z.object({ id: z.string(), kind: z.string(), status: z.string(), summary: z.string(), subject: Subject.nullable() })),
});
export type RunDetail = z.infer<typeof RunDetail>;

export const SettingsPatch = z.object({
  enabled: z.boolean().optional(),
  autoApprove: z.record(z.string(), z.boolean()).optional(),
});
export type SettingsPatch = z.infer<typeof SettingsPatch>;
