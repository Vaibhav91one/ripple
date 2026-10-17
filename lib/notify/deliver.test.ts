// Delivery pipeline on a real Postgres (skips without DATABASE_URL; CI sets it) with an injected clock: nothing sleeps.
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { closeClient, graphFor, query, type Graph } from "../graph/client";
import { RippleEvent } from "../events/types";
import { loadSnapshot, snapshotGraphReader } from "./graph-reader";
import type { Adapter } from "./deliver";
import type { GraphReader, Prefs, PrefsReader } from "./types";

vi.mock("server-only", () => ({}));
const url = process.env.DATABASE_URL;

const graph: GraphReader = {
  changeOwner: () => null, teamOwners: () => [], systemOwners: () => [], acknowledgers: () => [], taskAssignees: () => [],
  teamLead: () => null, teamLeadOf: () => null, resourceOwners: () => [], prOwners: () => [], digestRecipients: () => [], revision: () => "0",
};
const prefsOf = (p: Record<string, Prefs> = {}): PrefsReader => ({ get: (id) => p[id] });
const NOW = 900 * 1_990_000; // start of a 15-minute batch bucket
const ev = (org: string, type: string, id: string, payload: object) =>
  RippleEvent.parse({ type, orgId: org, subject: { kind: "task", id }, payload, dedupeKey: `${type}:${id}` });
const assigned = (org: string, id: string, userId: string) => ev(org, "task.assigned", id, { taskId: id, userId });

describe.skipIf(!url)("delivery pipeline (Postgres)", () => {
  const org = `test-deliv-${randomUUID()}`;
  const enqueue = vi.fn<(name: string, data: object, opts?: { singletonKey?: string; startAfter?: Date }) => Promise<string>>(async () => "job");
  const sends: { channel: string; to: string; subject: string; lines: string[] }[] = [];
  const adapter: Adapter = { send: async (channel, p, m) => { sends.push({ channel, to: p.id, subject: m.subject, lines: m.lines }); return { status: "sent", providerId: `p${sends.length}` }; } };
  const person = (id: string) => ({ id, email: `${id}@x.test` });

  afterAll(async () => {
    if (!url) return;
    const { db } = await import("../db");
    const { notifications } = await import("../db/schema");
    const { eq } = await import("drizzle-orm");
    await db().delete(notifications).where(eq(notifications.orgId, org)); // cascades deliveries
  });

  const run = async (event: RippleEvent, now: number, prefs = prefsOf()) => {
    const { db } = await import("../db");
    const { routeAndStore } = await import("./deliver");
    return routeAndStore(db(), event, undefined, { graph, prefs, now, enqueue: enqueue as never });
  };
  const deliver = async (batchKey: string, now = NOW) => {
    const { db } = await import("../db");
    const { deliverBatch } = await import("./deliver");
    return deliverBatch(db(), { orgId: org, batchKey }, { adapter, person, now: () => now });
  };

  it("three normal events for one person in 15 minutes become one delivery", async () => {
    await run(assigned(org, "t1", "p-a"), NOW + 10);
    await run(assigned(org, "t2", "p-a"), NOW + 300);
    await run(assigned(org, "t3", "p-a"), NOW + 899);
    const calls = enqueue.mock.calls.filter((c) => (c[1] as { orgId: string }).orgId === org);
    expect(calls).toHaveLength(3);
    const key = `p-a:${NOW / 900}`;
    expect(new Set(calls.map((c) => c[2]?.singletonKey))).toEqual(new Set([key])); // pg-boss keeps one queued job for it
    expect(calls[0][2]?.startAfter).toEqual(new Date((NOW + 900) * 1000)); // fires at the end of the bucket

    const out = await deliver(key, NOW + 900);
    expect(out).toHaveLength(1);
    expect(sends).toEqual([{ channel: "slack_dm", to: "p-a", subject: "3 updates from Ripple", lines: expect.any(Array) }]);
    expect(sends[0].lines).toHaveLength(3);

    const { db } = await import("../db");
    const { deliveries } = await import("../db/schema");
    const rows = (await db().select().from(deliveries)).filter((r) => out[0].notificationIds.includes(r.notificationId));
    expect(rows).toHaveLength(3);
    expect(rows.every((r) => r.status === "sent" && r.providerId === "p1" && r.sentAt?.getTime() === (NOW + 900) * 1000)).toBe(true);

    expect(await deliver(key, NOW + 901)).toEqual([]); // a re-run never double-sends
    expect(sends).toHaveLength(1);
  });

  it("the same event twice gives one notification and one queued delivery", async () => {
    enqueue.mockClear();
    const e = assigned(org, "dupe", "p-b");
    expect((await run(e, NOW)).stored).toBe(1);
    expect((await run(e, NOW + 5)).stored).toBe(0);
    expect(enqueue).toHaveBeenCalledTimes(1);
  });

  it("high urgency skips batching and quiet hours; normal waits them out", async () => {
    enqueue.mockClear();
    const quiet = { "p-c": { quietHours: { start: "00:00", end: "23:00", tz: "UTC" } } }; // NOW is 00:00 UTC-ish: inside
    const high = ev(org, "approval.requested", "t-hi", { changeId: "c1", approverId: "p-c" });
    await run(high, NOW, prefsOf(quiet));
    const [, data, opts] = enqueue.mock.calls[0];
    expect(opts?.startAfter).toBeUndefined(); // immediate
    expect((data as { batchKey: string }).batchKey).toContain("approval.requested"); // own batch, not p-c:<bucket>
    expect((await deliver((data as { batchKey: string }).batchKey)).map((o) => o.channel)).toEqual(["slack_dm", "email"]); // one message per channel

    enqueue.mockClear();
    await run(assigned(org, "t-lo", "p-c"), NOW, prefsOf(quiet));
    expect(enqueue.mock.calls[0][2]?.startAfter!.getTime()).toBeGreaterThanOrEqual(NOW * 1000 + 3600_000); // pushed past the quiet window
  });

  it("the inbox returns only the viewer's notifications and mark-read ignores other people's", async () => {
    const { listNotifications, markRead } = await import("./inbox");
    await run(assigned(org, "t-inbox", "p-d"), NOW);
    const a = await listNotifications(org, "p-d");
    expect(a.notifications.length).toBe(1);
    expect(a.notifications.every((n) => n.subject.id === "t-inbox")).toBe(true);
    expect(a.unread).toBe(1);
    const other = await listNotifications(org, "p-a");
    expect(other.notifications.some((n) => n.subject.id === "t-inbox")).toBe(false);

    expect(await markRead(org, "p-a", [a.notifications[0].id])).toBe(0); // not p-a's
    expect(await markRead(org, "p-d", [a.notifications[0].id])).toBe(1);
    expect((await listNotifications(org, "p-d")).unread).toBe(0);
    expect(await listNotifications("another-org", "p-d")).toEqual({ notifications: [], unread: 0 });
  });

  it("records a failed send honestly", async () => {
    const { db } = await import("../db");
    const { deliverBatch } = await import("./deliver");
    await run(assigned(org, "t-fail", "p-e"), NOW);
    const out = await deliverBatch(db(), { orgId: org, batchKey: `p-e:${NOW / 900}` }, {
      adapter: { send: async () => { throw new Error("boom"); } }, person, now: () => NOW,
    });
    expect(out[0].result).toEqual({ status: "failed", error: "boom" });
  });
});

describe("snapshotGraphReader", () => {
  const r = snapshotGraphReader({
    people: [{ id: "lead", title: "Support Lead", teamId: "support" }, { id: "dev", title: "Engineer", teamId: "support" }, { id: "own", title: "Engineer", teamId: "eng" }],
    changes: [{ id: "c1", owner: "own", systems: ["s1"], revision: "open:0" }],
    acks: [{ changeId: "c1", teamId: "eng", by: "own" }],
    owns: [{ teamId: "support", systemId: "s1" }, { teamId: "eng", systemId: "s1" }],
    tasks: [{ id: "k1", assigneeId: "dev" }, { id: "k2", assigneeId: "ghost" }],
  });
  it("derives owners, gap, leads and drops unknown people", () => {
    expect(r.changeOwner("c1")).toBe("own");
    expect(r.teamOwners("c1")).toEqual(["lead"]); // eng acked, so only support is in the gap
    expect(r.acknowledgers("c1")).toEqual(["own"]);
    expect(r.teamLead("dev")).toBe("lead");
    expect(r.teamLead("lead")).toBeNull();
    expect(r.taskAssignees("k1")).toEqual(["dev"]);
    expect(r.taskAssignees("k2")).toEqual([]);
    expect(r.revision({ kind: "change", id: "c1" })).toBe("open:0");
    expect(r.revision({ kind: "change", id: "nope" })).toBe("0");
  });
});

describe("loadSnapshot (FalkorDB)", () => {
  const name = `test_nd_${randomUUID().replaceAll("-", "")}`;
  let g: Graph;
  let up = false;
  beforeAll(async () => {
    try {
      g = await graphFor(name);
      await query(g, `CREATE (:Team {id:'support'}), (:Team {id:'eng'}), (:System {id:'s1'}),
        (:Person {id:'ana', title:'Support Lead', teamId:'support', email:'ana@x.test', active:true}),
        (:Person {id:'gone', title:'Support Lead', teamId:'support', active:false}),
        (:Change {id:'c1', owner:'ana', status:'open', effective_at: 5}), (:Task {id:'k1', assigneeId:'ana'})`);
      await query(g, "MATCH (t:Team {id:'support'}), (s:System {id:'s1'}), (c:Change {id:'c1'}) CREATE (t)-[:OWNS]->(s), (c)-[:AFFECTED {valid_to: null}]->(s)");
      up = true;
    } catch (e) {
      console.warn(`SKIPPING graph snapshot test: FalkorDB unreachable (${String(e)})`);
    }
  }, 30_000);
  afterAll(async () => {
    if (up) await g.delete();
    await closeClient();
  });
  it("reads people, changes, ownership and tasks from the graph", async (ctx) => {
    if (!up) ctx.skip();
    const snap = await loadSnapshot(g);
    expect(snap.people.map((p) => p.id)).toEqual(["ana"]); // inactive people never get notified
    expect(snap.changes).toEqual([{ id: "c1", owner: "ana", systems: ["s1"], revision: "open:5" }]);
    expect(snap.owns).toEqual([{ teamId: "support", systemId: "s1" }]);
    const r = snapshotGraphReader(snap);
    expect(r.teamOwners("c1")).toEqual(["ana"]);
    expect(r.taskAssignees("k1")).toEqual(["ana"]);
  });
});
