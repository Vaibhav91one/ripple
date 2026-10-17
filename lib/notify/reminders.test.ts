// 48h reminder, 96h escalation, ack cancellation and the ledger. Injected clock: nothing sleeps.
// Needs Postgres (pg-boss + the notification tables); skips without DATABASE_URL, CI sets it.
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { PgBoss } from "pg-boss";
import { RippleEvent } from "../events/types";
import type { enqueue as Enqueue } from "../queue";
import { snapshotGraphReader, type Snapshot } from "./graph-reader";
import { route } from "./route";
import type { RippleEvent as Ev } from "../events/types";

vi.mock("server-only", () => ({}));
const url = process.env.DATABASE_URL;
const schema = `test_boss_${randomUUID().replaceAll("-", "").slice(0, 12)}`;
process.env.PGBOSS_SCHEMA = schema;

const T0 = 1_800_000_000; // delivery time, epoch seconds
const H = 3600;
const snap = (acks: Snapshot["acks"] = []): Snapshot => ({
  people: [
    { id: "p-lead", title: "Support Lead", teamId: "t-sup" }, { id: "p-nia", title: "Agent", teamId: "t-sup" },
    { id: "p-owner", title: "PM", teamId: "t-pm" },
  ],
  changes: [{ id: "c1", owner: "p-owner", systems: ["s1"], revision: "r1" }],
  acks, owns: [{ teamId: "t-sup", systemId: "s1" }], tasks: [],
});

describe.skipIf(!url)("reminders (Postgres)", () => {
  const org = `test-rem-${randomUUID()}`;
  let boss: PgBoss;
  let enq: typeof Enqueue;

  beforeAll(async () => {
    const { bossOptions } = await import("../queue");
    boss = new PgBoss(bossOptions(url!));
    await boss.start();
    await boss.createQueue("reminder", { policy: "short" });
    enq = (async (name, data, opts) => boss.send(name, data, opts)) as typeof Enqueue;
  });
  afterAll(async () => {
    await boss.stop({ graceful: false });
    const sql = (await import("postgres")).default(url!, { max: 1, onnotice: () => {} });
    await sql.unsafe(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    await sql.end();
    const { db } = await import("../db");
    const { notifications } = await import("../db/schema");
    const { eq } = await import("drizzle-orm");
    await db().delete(notifications).where(eq(notifications.orgId, org));
  });

  const queued = (userId: string) => boss.findJobs<{ kind: string }>("reminder", { data: { changeId: "c1", userId }, queued: true });
  const job = (userId: string, kind: "48h" | "96h") => ({ orgId: org, changeId: "c1", userId, kind });

  it("schedules 48h and 96h after delivery, once per person and change", async () => {
    const { scheduleReminders } = await import("./reminders");
    await scheduleReminders(enq, { orgId: org, changeId: "c1", userId: "p-nia" }, T0);
    await scheduleReminders(enq, { orgId: org, changeId: "c1", userId: "p-nia" }, T0 + 60); // a re-delivery adds nothing
    const jobs = (await queued("p-nia")).sort((a, b) => +a.startAfter - +b.startAfter);
    expect(jobs.map((j) => [j.data.kind, j.startAfter.getTime() / 1000])).toEqual([["48h", T0 + 48 * H], ["96h", T0 + 96 * H]]);
  });

  it("an unacked person is reminded at 48h and the lead hears at 96h, change owner copied", async () => {
    const { handleReminder } = await import("./reminders");
    const emit = vi.fn<(e: Ev) => Promise<undefined>>(async () => undefined);
    expect(await handleReminder(job("p-nia", "48h"), { snapshot: snap(), emit })).toBe("emitted");
    expect(await handleReminder(job("p-nia", "96h"), { snapshot: snap(), emit })).toBe("emitted");
    const [e48, e96] = emit.mock.calls.map((c) => RippleEvent.parse(c[0]));
    expect([e48.type, e96.type]).toEqual(["ack.missing_48h", "ack.missing_96h"]);

    const reader = snapshotGraphReader(snap());
    const plan = (e: Ev) => route(e, reader, { get: () => undefined }, T0 + 96 * H).map((p) => [p.personId, p.reason]);
    expect(plan(e48)).toEqual([["p-nia", "ack_reminder:48h"]]);
    expect(plan(e96)).toEqual([["p-lead", "escalation:96h"], ["p-nia", "ack_reminder:96h"], ["p-owner", "escalation_cc:96h"]]);
  });

  it("does nothing when the person or their team has acknowledged", async () => {
    const { handleReminder } = await import("./reminders");
    const emit = vi.fn(async () => undefined);
    for (const acks of [[{ changeId: "c1", teamId: "t-sup", by: "p-lead" }], [{ changeId: "c1", teamId: "t-other", by: "p-nia" }]]) {
      expect(await handleReminder(job("p-nia", "48h"), { snapshot: snap(acks), emit })).toBe("acked");
    }
    expect(await handleReminder(job("p-nia", "48h"), { snapshot: snap([{ changeId: "c2", teamId: "t-sup", by: "p-lead" }]), emit })).toBe("emitted");
    expect(emit).toHaveBeenCalledTimes(1); // only the ack for a different change did not count
  });

  it("an ack before 48h cancels both pending reminders", async () => {
    const { scheduleReminders, cancelReminders } = await import("./reminders");
    await scheduleReminders(enq, { orgId: org, changeId: "c1", userId: "p-lead" }, T0);
    expect(await queued("p-lead")).toHaveLength(2);
    expect(await cancelReminders(boss, "c1", ["p-lead", "p-nobody"])).toBe(2);
    expect(await queued("p-lead")).toHaveLength(0);
    expect(await queued("p-nia")).toHaveLength(2); // other people keep theirs
  });

  it("a sent brief starts the clock; a failed one does not; the ledger reports only what happened", async () => {
    const { db } = await import("../db");
    const { notifications, deliveries } = await import("../db/schema");
    const { scheduleForSent } = await import("./reminders");
    const { ledgerFor } = await import("./ledger");
    const d = db();
    const mk = async (personId: string, kind: string, reason: string) =>
      (await d.insert(notifications).values({
        orgId: org, personId, kind, title: kind, body: { reason, subject: { kind: "change", id: "c1" } }, urgency: "normal",
        channels: ["slack_dm", "inbox"], batchKey: `b:${randomUUID()}`, dedupeKey: randomUUID(),
      }).returning({ id: notifications.id }))[0].id;
    const brief = await mk("p-owner", "brief.sent", "brief_recipient");
    const failed = await mk("p-lead", "brief.sent", "brief_recipient");
    await mk("p-owner", "ack.missing_48h", "ack_reminder:48h");
    await d.insert(deliveries).values([
      { notificationId: brief, channel: "slack_dm", status: "sent", sentAt: new Date(T0 * 1000) },
      { notificationId: failed, channel: "email", status: "failed", error: "no email address for person" },
    ]);

    const calls: unknown[][] = [];
    const spy = (async (...a: unknown[]) => { calls.push(a); return "id"; }) as unknown as typeof Enqueue;
    const n = await scheduleForSent(d, [
      { notificationIds: [brief], result: { status: "sent" } }, { notificationIds: [failed], result: { status: "failed" } },
    ], { enqueue: spy, now: T0 });
    expect(n).toBe(1);
    expect(calls.map((c) => [(c[1] as { userId: string }).userId, (c[1] as { kind: string }).kind])).toEqual([["p-owner", "48h"], ["p-owner", "96h"]]);

    const rows = await ledgerFor(d, org, "c1", (id) => snap().people.find((p) => p.id === id)?.teamId ?? null);
    expect(rows.map((r) => r.personId)).toEqual(["p-owner", "p-lead"]); // ordered by team: t-pm, t-sup
    const owner = rows.find((r) => r.personId === "p-owner")!;
    expect(owner).toMatchObject({ teamId: "t-pm", sentAt: new Date(T0 * 1000), deliveredAt: null, clickedAt: null, ackedAt: null });
    expect(owner.reminded["48h"]).toBeInstanceOf(Date);
    expect(owner.reminded["96h"]).toBeNull();
    expect(owner.channels).toEqual([{ channel: "slack_dm", status: "sent", error: null }]); // sent, never "read"
    const lead = rows.find((r) => r.personId === "p-lead")!;
    expect(lead.sentAt).toBeNull();
    expect(lead.channels).toEqual([{ channel: "email", status: "failed", error: "no email address for person" }]);
  });
});
