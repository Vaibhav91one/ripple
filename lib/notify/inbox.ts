// The viewer's own notifications. Every query is scoped to (org, person): nobody reads someone else's inbox.
import "server-only";
import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { db } from "../db";
import { notifications } from "../db/schema";
import type { NotificationList } from "../schemas";

export async function listNotifications(orgId: string, personId: string, limit = 50, d = db()): Promise<NotificationList> {
  const rows = await d.select().from(notifications)
    .where(and(eq(notifications.orgId, orgId), eq(notifications.personId, personId)))
    .orderBy(desc(notifications.createdAt)).limit(limit);
  return {
    notifications: rows.map((r) => ({
      id: r.id, kind: r.kind, title: r.title, reason: r.body.reason, subject: r.body.subject, urgency: r.urgency,
      createdAt: r.createdAt.toISOString(), readAt: r.readAt?.toISOString() ?? null,
    })),
    unread: rows.filter((r) => !r.readAt).length,
  };
}

/** Mark the viewer's notifications read: the given ids, or all of them. Other people's ids are ignored. Returns how many changed. */
export async function markRead(orgId: string, personId: string, ids: string[] | "all", now = new Date(), d = db()): Promise<number> {
  if (ids !== "all" && !ids.length) return 0;
  const mine = and(eq(notifications.orgId, orgId), eq(notifications.personId, personId), isNull(notifications.readAt));
  const rows = await d.update(notifications).set({ readAt: now })
    .where(ids === "all" ? mine : and(mine, inArray(notifications.id, ids))).returning({ id: notifications.id });
  return rows.length;
}
