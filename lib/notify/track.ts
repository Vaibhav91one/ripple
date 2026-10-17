// Delivery ledger state for button clicks. Monotonic: a click never undoes an ack. No DATABASE_URL = no-op, never an error.
import "server-only";
import { and, eq, ne, notInArray } from "drizzle-orm";
import { db } from "../db";
import { deliveries, notifications } from "../db/schema";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const on = (id: string) => !!process.env.DATABASE_URL && UUID.test(id);

/** queued/sent/delivered -> clicked -> acked. Returns whether a row changed. */
export async function markDelivery(id: string, to: "clicked" | "acked", now = new Date(), d = db()): Promise<boolean> {
  if (!on(id)) return false;
  const rows = await d.update(deliveries)
    .set(to === "acked" ? { status: "acked", ackedAt: now } : { status: "clicked", clickedAt: now })
    .where(and(eq(deliveries.id, id), to === "acked" ? ne(deliveries.status, "acked") : notInArray(deliveries.status, ["clicked", "acked"])))
    .returning({ id: deliveries.id });
  return rows.length > 0;
}

/** The tracked `open` link: record the click, return the item the delivery was about (null = unknown delivery). */
export async function clickDelivery(id: string, now = new Date(), d = db()): Promise<{ kind: string; id: string } | null> {
  if (!on(id)) return null;
  const [row] = await d.select({ body: notifications.body }).from(deliveries)
    .innerJoin(notifications, eq(notifications.id, deliveries.notificationId)).where(eq(deliveries.id, id));
  if (!row) return null;
  await markDelivery(id, "clicked", now, d);
  return row.body.subject;
}
