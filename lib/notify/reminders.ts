// Unacknowledged briefs: remind at +48h, escalate at +96h. Every function takes its deps and a clock, so tests never sleep.
import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type { PgBoss } from "pg-boss";
import type { RippleEvent } from "../events/types";
import type { enqueue as Enqueue } from "../queue";
import * as schema from "../db/schema";
import type { Snapshot } from "./graph-reader";

const HOUR = 3600;
export const REMINDERS = [{ kind: "48h", after: 48 * HOUR }, { kind: "96h", after: 96 * HOUR }] as const;
export type ReminderKind = (typeof REMINDERS)[number]["kind"];
export type ReminderJob = { orgId: string; changeId: string; userId: string; kind: ReminderKind };

/** Queue both reminders for one person and change, `after` the delivery. The singletonKey makes a re-delivery a no-op. */
export async function scheduleReminders(enqueue: typeof Enqueue, p: Omit<ReminderJob, "kind">, deliveredAt: number) {
  for (const r of REMINDERS) {
    await enqueue("reminder", { ...p, kind: r.kind }, {
      singletonKey: `reminder:${r.kind}:${p.changeId}:${p.userId}`, startAfter: new Date((deliveredAt + r.after) * 1000),
    });
  }
}

/** After a batch is sent: every sent brief.sent notification starts its reminder clock. The subject is the change. */
export async function scheduleForSent(
  d: PostgresJsDatabase<typeof schema>, sent: { notificationIds: string[]; result: { status: string } }[],
  deps: { enqueue: typeof Enqueue; now: number },
) {
  const ids = sent.filter((s) => s.result.status === "sent").flatMap((s) => s.notificationIds);
  if (!ids.length) return 0;
  const { notifications: n } = schema;
  const rows = await d.select().from(n).where(and(inArray(n.id, ids), eq(n.kind, "brief.sent")));
  for (const r of rows) await scheduleReminders(deps.enqueue, { orgId: r.orgId, changeId: r.body.subject.id, userId: r.personId }, deps.now);
  return rows.length;
}

/** Acknowledging cancels whatever is still queued for those people on that change. */
export async function cancelReminders(boss: Pick<PgBoss, "findJobs" | "cancel">, changeId: string, userIds: string[]) {
  let n = 0;
  for (const userId of userIds) {
    const jobs = await boss.findJobs("reminder", { data: { changeId, userId }, queued: true });
    if (jobs.length) await boss.cancel("reminder", jobs.map((j) => j.id));
    n += jobs.length;
  }
  return n;
}

/** The person, or their team, has acknowledged the change. */
export const isAcked = (s: Pick<Snapshot, "people" | "acks">, changeId: string, userId: string) => {
  const team = s.people.find((p) => p.id === userId)?.teamId;
  return s.acks.some((a) => a.changeId === changeId && (a.by === userId || (!!team && a.teamId === team)));
};

/** Reminder job fires: acked = nothing; otherwise emit ack.missing_<kind>, and routing does the rest. */
export async function handleReminder(job: ReminderJob, deps: { snapshot: Snapshot; emit: (e: RippleEvent) => Promise<unknown> }) {
  if (isAcked(deps.snapshot, job.changeId, job.userId)) return "acked" as const;
  const type = `ack.missing_${job.kind}` as const;
  await deps.emit({
    type, orgId: job.orgId, subject: { kind: "change", id: job.changeId }, payload: { changeId: job.changeId, userId: job.userId },
    dedupeKey: `${type}:${job.changeId}:${job.userId}`,
  });
  return "emitted" as const;
}
