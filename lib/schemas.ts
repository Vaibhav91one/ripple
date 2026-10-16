import { z } from "zod";

const id = z.string().min(1);
const ts = z.number().int(); // epoch seconds

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
  version: z.string().optional(),
  successor: id.optional(),
});
export const Customer = z.object({
  id,
  name: z.string(),
  arr: z.number().int(),
  tier: z.enum(["enterprise", "growth", "starter"]),
  region: z.string().optional(),
  monthlyCalls: z.number().int().optional(),
});
export const Deal = z.object({
  id,
  name: z.string(),
  stage: z.string(),
  amount: z.number().int(),
  closeDate: ts,
  customerId: id,
});
export const Contract = z.object({
  id,
  name: z.string(),
  endsAt: ts,
  customerId: id,
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
});
/** quote must be a verbatim substring of the artifact's text (enforced by `src()` in the mock and by tests). */
export const Source = z.object({ artifactId: id, quote: z.string().min(1) });
export const EdgeType = z.enum([
  "MEMBER_OF", "OWNS", "CARES_ABOUT", "MAINTAINS", "AUTHORED", "REVIEWED",
  "ASSIGNED", "ABOUT", "RAISED_BY", "HANDLED_BY", "DEPENDS_ON", "USES",
  "PROMISED", "GUARANTEES", "PARTY_TO", "OWNED_BY", "MANAGED_BY", "CONTACT",
  "SUNSETS", "SUPPORTED_BY", "SUPERSEDES", "INVOLVED_IN", "ACKED",
  "WAITING_ON", "NOTIFIES", "ATTENDED", "AFFECTED", "CAUSED_BY", "BETWEEN",
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
  severity: Severity,
  systemId: id,
  startedAt: ts,
  resolvedAt: ts.nullable(),
});
export const Task = z.object({
  id,
  title: z.string(),
  teamId: id,
  assigneeId: id.optional(),
  status: z.enum(["open", "in_review", "done"]),
  createdAt: ts,
});
export const Ack = z.object({
  teamId: id,
  decisionId: id,
  kind: z.enum(["seen", "concern", "not_relevant"]),
  by: id,
  at: ts,
});

export const RippleNode = z.object({
  id,
  label: z.string(),
  kind: z.enum([
    "team",
    "person",
    "decision",
    "system",
    "customer",
    "ticket",
    "deal",
    "contract",
  ]),
  hop: z.number().int().min(0),
});
export const RippleTeam = z.object({
  teamId: id,
  why: z.array(z.object({ reason: z.string(), ref: id, source: Source })),
  involved: z.boolean(),
  acked: z.boolean(),
});
export const RippleResult = z.object({
  decision: Decision,
  nodes: z.array(RippleNode),
  edges: z.array(z.object({ from: id, to: id, type: EdgeType })),
  teams: z.array(RippleTeam),
  gap: z.array(id),
  conflicts: z.array(Conflict),
  counts: z.object({
    teamsAffected: z.number().int(), // excludes the deciding team
    notTold: z.number().int(),
    conflicts: z.number().int(),
    customers: z.number().int(),
    tickets: z.number().int(),
    deals: z.number().int(),
    contracts: z.number().int(),
    arrAtRisk: z.number().int(),
  }),
  cypher: z.array(z.object({ name: z.string(), text: z.string() })),
});

export const Brief = z.object({
  teamId: id,
  decisionId: id,
  claims: z.array(z.object({ text: z.string(), sources: z.array(Source) })),
});
export const Change = z.object({
  edge: Edge,
  kind: z.enum(["added", "ended"]),
  at: ts,
});
/** Request-bottleneck table, built from WAITING_ON edges. */
export const BottleneckRow = z.object({
  blockerTeamId: id,
  openRequests: z.number().int(),
  totalWaitDays: z.number().int(),
  oldestDays: z.number().int(),
  waitingTeamIds: z.array(id),
});
export const WhoKnowsRow = z.object({
  personId: id,
  systemId: id,
  authored: z.number().int(),
  reviewed: z.number().int(),
  handled: z.number().int(),
  lastSeen: ts,
});
const inboxBase = { id, title: z.string(), at: ts };
export const InboxItem = z.discriminatedUnion("kind", [
  z.object({
    ...inboxBase,
    kind: z.literal("brief"),
    teamId: id,
    decisionId: id,
  }),
  z.object({ ...inboxBase, kind: z.literal("review"), taskId: id, from: id }),
  z.object({ ...inboxBase, kind: z.literal("waiting"), waitingOn: id }),
]);

export const StreamEvent = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("tool_call"),
    tool: z.string(),
    args: z.record(z.string(), z.unknown()),
    cypher: z.string(),
  }),
  z.object({
    type: z.literal("tool_result"),
    tool: z.string(),
    rows: z.array(z.record(z.string(), z.unknown())),
    sourceIds: z.array(id),
  }),
  z.object({ type: z.literal("text_delta"), text: z.string() }),
  z.object({
    type: z.literal("citation"),
    claimId: id,
    sources: z.array(Source),
  }),
  z.object({ type: z.literal("done") }),
]);

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
export type RippleResult = z.infer<typeof RippleResult>;
export type Brief = z.infer<typeof Brief>;
export type Change = z.infer<typeof Change>;
export type BottleneckRow = z.infer<typeof BottleneckRow>;
export type WhoKnowsRow = z.infer<typeof WhoKnowsRow>;
export type InboxItem = z.infer<typeof InboxItem>;
export type StreamEvent = z.infer<typeof StreamEvent>;
