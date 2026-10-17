import { z } from "zod";
import { id, ts } from "./common";
import { Source } from "./core";

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

export type BottleneckRow = z.infer<typeof BottleneckRow>;
export type WhoKnowsRow = z.infer<typeof WhoKnowsRow>;
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
