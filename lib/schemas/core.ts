import { z } from "zod";
import { id, ts } from "./common";

export const Team = z.object({ id, name: z.string() });
export const Person = z.object({
  id,
  name: z.string(),
  title: z.string(),
  email: z.string(),
  teamId: id,
  active: z.boolean(),
});
export const System = z.object({
  id,
  name: z.string(),
  kind: z.enum(["api", "service", "repo"]),
  status: z.enum(["current", "deprecated", "sunset"]),
  // nullish: cypher returns null for a missing property
  version: z.string().nullish(),
  successor: id.nullish(),
  onCallPersonId: id.nullish(),
});
export const Customer = z.object({
  id,
  name: z.string(),
  /** null = restricted to Sales (see lib/permissions) */
  arr: z.number().int().nullable(),
  tier: z.enum(["enterprise", "growth", "starter"]),
  region: z.string().optional(),
  monthlyCalls: z.number().int().optional(),
  healthScore: z.number().int().min(0).max(100),
  renewalDate: ts,
});
export const DealStage = z.enum(["prospecting", "qualified", "proposal", "negotiation", "closed_won", "closed_lost"]);
export const Deal = z.object({
  id,
  name: z.string(),
  stage: DealStage,
  probability: z.number().int().min(0).max(100),
  ownerId: id,
  amount: z.number().int(),
  closeDate: ts,
  customerId: id,
  v1Related: z.boolean(),
});
export const Contract = z.object({
  id,
  name: z.string(),
  endsAt: ts,
  customerId: id,
  noticeDays: z.number().int(),
  value: z.number().int(),
  approvalState: z.enum(["draft", "in_review", "approved", "signed"]),
});
export const Decision = z.object({
  id,
  title: z.string(),
  status: z.enum(["proposed", "accepted", "superseded"]),
  decidedAt: ts,
});
export const Artifact = z.object({
  id,
  kind: z.enum(["doc", "ticket", "message", "pr"]),
  docKind: z
    .enum(["rfc", "meeting_notes", "changelog", "postmortem"])
    .optional(),
  status: z.enum(["open", "closed"]).optional(),
  title: z.string(),
  text: z.string(),
  ts,
  uri: z.string(),
  authorId: id,
  /** owner team id when title, text and uri are withheld from this viewer */
  restricted: id.optional(),
});
/** quote must be a verbatim substring of the artifact's text (enforced by `src()` in the mock and by tests). */
export const Source = z.object({
  artifactId: id,
  quote: z.string().min(1),
  /** owner team id when the quote is restricted: `quote` is then a placeholder, never the text */
  restricted: id.optional(),
});
export const EdgeType = z.enum([
  "MEMBER_OF", "OWNS", "CARES_ABOUT", "MAINTAINS", "AUTHORED", "REVIEWED",
  "ASSIGNED", "ABOUT", "RAISED_BY", "HANDLED_BY", "DEPENDS_ON", "USES",
  "PROMISED", "GUARANTEES", "PARTY_TO", "OWNED_BY", "MANAGED_BY", "CONTACT",
  "SUNSETS", "SUPPORTED_BY", "SUPERSEDES", "INVOLVED_IN", "ACKED",
  "WAITING_ON", "NOTIFIES", "ATTENDED", "AFFECTED", "CAUSED_BY", "BETWEEN",
  // v2 dashboards: clause of a contract, control covers a framework, goal/blocker, finding on a system, PR review request
  "HAS_CLAUSE", "COVERS", "BLOCKED_BY", "FOUND_IN", "REQUESTED_REVIEW",
]);
export type EdgeType = z.infer<typeof EdgeType>;
export const Edge = z.object({
  from: id,
  to: id,
  type: EdgeType,
  validFrom: ts,
  validTo: ts.nullable(),
  src: Source.optional(),
});
export const Severity = z.enum(["low", "medium", "high"]);
export const Conflict = z.object({
  id,
  kind: z.literal("sunset_vs_guarantee"),
  severity: Severity,
  status: z.enum(["open", "resolved"]),
  decisionId: id,
  contractIds: z.array(id),
  detectedAt: ts,
  sources: z.array(Source),
});
export const Incident = z.object({
  id,
  title: z.string(),
  severity: z.enum(["low", "medium", "high", "critical"]),
  systemId: id,
  startedAt: ts,
  acknowledgedAt: ts.nullable(),
  resolvedAt: ts.nullable(),
});
export const Task = z.object({
  id,
  title: z.string(),
  teamId: id,
  assigneeId: id.nullish(),
  status: z.enum(["open", "in_review", "done"]),
  createdAt: ts,
  kind: z.enum(["questionnaire", "access_review", "review", "general"]).nullish(),
  dueAt: ts.nullish(),
  /** The brief's cited claims, for tasks created by a notification. */
  body: z.string().nullish(),
});
export const Ack = z.object({
  teamId: id,
  decisionId: id,
  kind: z.enum(["seen", "concern", "not_relevant"]),
  by: id,
  at: ts,
});

export type Team = z.infer<typeof Team>;
export type Person = z.infer<typeof Person>;
export type System = z.infer<typeof System>;
export type Customer = z.infer<typeof Customer>;
export type Deal = z.infer<typeof Deal>;
export type Contract = z.infer<typeof Contract>;
export type Decision = z.infer<typeof Decision>;
export type Artifact = z.infer<typeof Artifact>;
export type Source = z.infer<typeof Source>;
export type Edge = z.infer<typeof Edge>;
export type Conflict = z.infer<typeof Conflict>;
export type Incident = z.infer<typeof Incident>;
export type Task = z.infer<typeof Task>;
export type Ack = z.infer<typeof Ack>;
