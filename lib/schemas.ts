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
  // nullish: cypher returns null for a missing property
  version: z.string().nullish(),
  successor: id.nullish(),
  onCallPersonId: id.nullish(),
});
export const Customer = z.object({
  id,
  name: z.string(),
  arr: z.number().int(),
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
});
/** quote must be a verbatim substring of the artifact's text (enforced by `src()` in the mock and by tests). */
export const Source = z.object({ artifactId: id, quote: z.string().min(1) });
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

/** A brief the person's team sent to another team about a decision, with where that team stands. */
export const SentItem = z.object({
  ...inboxBase,
  kind: z.literal("sent"),
  teamId: id,
  decisionId: id,
  status: z.enum(["pending", "acked"]),
});
/** `forMe`: addressed to the person (briefs to acknowledge, reviews, who is waiting). `sent`: what they sent out. */
export const Inbox = z.object({ forMe: z.array(InboxItem), sent: z.array(SentItem) });

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
export type SentItem = z.infer<typeof SentItem>;
export type Inbox = z.infer<typeof Inbox>;
export type StreamEvent = z.infer<typeof StreamEvent>;

// ---------- v2 dashboard rows (ids only; screens resolve names with getNames) ----------
export const Priority = z.enum(["urgent", "high", "normal", "low"]);
export const TicketRow = z.object({
  id,
  title: z.string(),
  status: z.enum(["open", "closed"]),
  priority: Priority,
  createdAt: ts,
  firstResponseAt: ts.nullable(),
  slaDueAt: ts,
  assigneeId: id,
  customerId: id.nullable(),
  systemId: id.nullable(),
  v1Related: z.boolean(),
});
export const PrRow = z.object({
  id,
  title: z.string(),
  repo: id,
  authorId: id,
  state: z.enum(["open", "merged", "closed"]),
  additions: z.number().int(),
  deletions: z.number().int(),
  createdAt: ts,
  firstReviewAt: ts.nullable(),
  mergedAt: ts.nullable(),
  reviewerIds: z.array(id),
  v1Related: z.boolean(),
});
export const Clause = z.object({
  id,
  contractId: id,
  number: z.string(),
  title: z.string(),
  text: z.string(),
  risk: z.enum(["low", "med", "high"]),
  dueAt: ts.nullable(),
  src: Source,
  v1Related: z.boolean(),
});
export const Framework = z.object({ id, name: z.string() });
export const Control = z.object({
  id,
  frameworkId: id,
  name: z.string(),
  status: z.enum(["passing", "failing"]),
  auditBlocking: z.boolean(),
  ownerId: id,
  v1Related: z.boolean(),
});
export const Vendor = z.object({
  id,
  name: z.string(),
  riskTier: z.enum(["low", "medium", "high"]),
  assessmentStatus: z.enum(["current", "due", "overdue"]),
  nextReview: ts,
});
export const Finding = z.object({
  id,
  title: z.string(),
  severity: z.enum(["low", "medium", "high", "critical"]),
  slaDueAt: ts,
  systemId: id,
  status: z.enum(["open", "in_progress", "resolved"]),
  ownerId: id,
  v1Related: z.boolean(),
});
export const Risk = z.object({
  id,
  title: z.string(),
  likelihood: z.number().int().min(1).max(5),
  impact: z.number().int().min(1).max(5),
  status: z.enum(["open", "mitigating", "accepted"]),
  ownerId: id,
  teamId: id,
  v1Related: z.boolean(),
});
export const Page = z.object({
  id,
  path: z.string(),
  views30d: z.number().int(),
  feedbackUp: z.number().int(),
  feedbackDown: z.number().int(),
  v1Related: z.boolean(),
});
export const DocsStats = z.object({
  id,
  failedSearches: z.array(z.object({ query: z.string(), count: z.number().int() })),
  sdkAdoption: z.array(z.object({ sdk: z.string(), version: z.string(), share: z.number().int() })),
});
export const Goal = z.object({
  id,
  title: z.string(),
  ownerTeamId: id,
  progress: z.number().int().min(0).max(100),
  status: z.enum(["on_track", "at_risk", "off_track"]),
  target: z.number().int().nullish(),
  current: z.number().int().nullish(),
});
/** A BLOCKED_BY edge: `fromId` (a goal) cannot move until `toId` (a decision or finding) is resolved. */
export const Blocker = z.object({ fromId: id, toId: id, since: ts });

export const Kpi = z.object({
  id,
  label: z.string(),
  value: z.number(),
  unit: z.enum(["count", "usd", "percent", "hours"]),
  tone: z.enum(["ok", "warn", "bad"]).optional(),
});
/** The "Ripple angle" every team dashboard carries: what the v1 sunset means for this team. */
export const RippleAngle = z.object({
  decisionId: id.nullable(),
  affected: z.boolean(),
  involved: z.boolean(),
  acked: z.boolean(),
  changes: z.array(Change),
  facts: z.array(z.object({ text: z.string(), source: Source })).max(3),
});
export const TeamStripItem = z.object({
  teamId: id,
  name: z.string(),
  people: z.number().int(),
  affected: z.boolean(),
  told: z.boolean(),
});
export const Overview = z.object({
  now: ts,
  kpis: z.array(Kpi),
  openDecisions: z.array(z.object({ decision: Decision, notTold: z.array(id) })),
  blockers: z.array(Blocker),
  recentChanges: z.array(Change),
  activity: z.array(z.object({ day: ts, changes: z.number().int(), acks: z.number().int() })),
  whoKnows: z.array(WhoKnowsRow),
  teams: z.array(TeamStripItem),
});

export type TicketRow = z.infer<typeof TicketRow>;
export type PrRow = z.infer<typeof PrRow>;
export type Clause = z.infer<typeof Clause>;
export type Framework = z.infer<typeof Framework>;
export type Control = z.infer<typeof Control>;
export type Vendor = z.infer<typeof Vendor>;
export type Finding = z.infer<typeof Finding>;
export type Risk = z.infer<typeof Risk>;
export type Page = z.infer<typeof Page>;
export type DocsStats = z.infer<typeof DocsStats>;
export type Goal = z.infer<typeof Goal>;
export type Blocker = z.infer<typeof Blocker>;
export type Kpi = z.infer<typeof Kpi>;
export type RippleAngle = z.infer<typeof RippleAngle>;
export type TeamStripItem = z.infer<typeof TeamStripItem>;
export type Overview = z.infer<typeof Overview>;
