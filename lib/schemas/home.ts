import { z } from "zod";
import { id, ts } from "./common";
import { Source } from "./core";
import { Subject } from "./approvals";
import { Inbox, NotificationList } from "./inbox";
import { RippleAngle } from "./overview";

/** What one decision means for the viewer's team: `conflict` = not acknowledged and a promise clashes, `gap` = not yet acknowledged, `covered` = acknowledged. */
export const HomeHit = z.object({
  decisionId: id,
  title: z.string(),
  status: z.enum(["conflict", "gap", "covered"]),
  conflicts: z.number().int(),
  /** The contracts behind the open conflicts (names come from /api/names, which hides what the viewer may not see). */
  contractIds: z.array(id),
  /** Why it reaches the team: the ripple's cited claims. */
  why: z.array(z.object({ text: z.string(), source: Source })),
});
/** A brief the viewer's team has not acknowledged, with the signed tokens the inline ack buttons post to /api/ack. */
export const HomeBrief = z.object({
  id,
  decisionId: id,
  title: z.string(),
  at: ts,
  /** null for anonymous demo viewers: the shared demo is read-only, so no ack tokens are minted. */
  tokens: z.object({ seen: z.string(), concern: z.string(), not_relevant: z.string() }).nullable(),
});
export const HomeApproval = z.object({ id: z.string(), kind: z.string(), requestedAt: z.string(), subject: Subject.nullable() });
export const HomeTask = z.object({
  id, title: z.string(), status: z.enum(["open", "in_review"]), dueAt: ts.nullable(), mine: z.boolean(),
});

export const Home = z.object({
  teamId: id.nullable(),
  /** briefs/reviews/waiting for the viewer, briefs the team sent (the old Inbox payload, nothing dropped) */
  inbox: Inbox,
  briefs: z.array(HomeBrief),
  hits: z.array(HomeHit),
  tasks: z.array(HomeTask),
  /** Pending actions the viewer may decide (kind access_request is split out). Empty without Postgres. */
  approvals: z.array(HomeApproval),
  accessRequests: z.array(HomeApproval),
  angle: RippleAngle.nullable(),
  conflicts: z.number().int(),
  notifications: NotificationList,
});
export type Home = z.infer<typeof Home>;
export type HomeBrief = z.infer<typeof HomeBrief>;
export type HomeHit = z.infer<typeof HomeHit>;
