import { z } from "zod";
import { id, ts } from "./common";

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

export type InboxItem = z.infer<typeof InboxItem>;
export type SentItem = z.infer<typeof SentItem>;
export type Inbox = z.infer<typeof Inbox>;

/** The in-app notification copy (Postgres `notification`), as the inbox API returns it. */
export const NotificationItem = z.object({
  id: z.string(),
  kind: z.string(),
  title: z.string(),
  reason: z.string(),
  subject: z.object({ kind: z.string(), id: z.string() }),
  urgency: z.enum(["high", "normal", "low"]),
  createdAt: z.string(),
  readAt: z.string().nullable(),
});
export const NotificationList = z.object({ notifications: z.array(NotificationItem), unread: z.number() });
export type NotificationList = z.infer<typeof NotificationList>;
