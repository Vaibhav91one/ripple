// Chase end to end: propose send_reminder -> approve -> execute emits campaign.chase -> route() plan -> deliveries queued.
// Needs Postgres and FalkorDB; skips without.
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { closeClient, graphFor, query, type Graph } from "../graph/client";
import { seed } from "../ingest/seed";

vi.mock("server-only", () => ({}));
const enqueue = vi.fn<(name: string, data: object, opts?: object) => Promise<string>>(async () => "job");
vi.mock("../queue", () => ({ enqueue }));

const gname = `test_chase_${randomUUID().replaceAll("-", "")}`;
const org = { id: `test-chase-${randomUUID()}` };
let g: Graph;
let up = false;

beforeAll(async () => {
  if (!process.env.DATABASE_URL) return;
  try {
    g = await graphFor(gname);
    await query(g, "RETURN 1");
    await seed(gname);
    up = true;
  } catch (e) {
    console.warn(`SKIPPING chase test: ${String(e)}`);
  }
}, 30_000);

afterAll(async () => {
  if (up) await g.delete();
  await closeClient();
  if (!process.env.DATABASE_URL) return;
  const { db } = await import("../db");
  const s = await import("../db/schema");
  const { eq } = await import("drizzle-orm");
  for (const t of [s.notifications, s.pendingActions, s.auditLog, s.events]) await db().delete(t).where(eq(t.orgId, org.id));
});

describe.skipIf(!process.env.DATABASE_URL)("chase (Postgres + FalkorDB)", () => {
  it("approving a chase emits campaign.chase, routes it to the team owner (CC change owner) and queues the delivery", async (c) => {
    if (!up) c.skip();
    const { propose } = await import("./propose");
    const { approve } = await import("./decide");
    const { executeAction } = await import("./execute");
    const { db } = await import("../db");
    const { events, notifications } = await import("../db/schema");
    const { and, eq } = await import("drizzle-orm");
    const { RippleEvent } = await import("../events/types");
    const { loadGraphReader } = await import("../notify/graph-reader");
    const { routeAndStore } = await import("../notify/deliver");

    const p = await propose({ org, viewer: { kind: "user", id: "u1" } }, "send_reminder", { decisionId: "d-1", teamId: "legal", title: "Chase legal" });
    expect(p.status).toBe("pending"); // nothing is emitted until someone approves
    expect(await db().select().from(events).where(eq(events.orgId, org.id)).then((r) => r.filter((e) => e.type === "campaign.chase"))).toHaveLength(0);

    await approve({ org, viewer: { kind: "user", id: "u1", role: "lead" } }, p.id);
    expect(await executeAction(p.id, g)).toBe("executed");
    const [row] = (await db().select().from(events).where(eq(events.orgId, org.id))).filter((e) => e.type === "campaign.chase");
    const event = RippleEvent.parse({ type: row.type, orgId: row.orgId, subject: { kind: row.subjectKind, id: row.subjectId }, payload: row.payload, dedupeKey: row.dedupeKey });
    expect(event.payload).toEqual({ changeId: "d-1", teamId: "legal", by: "u1" });

    const { reader, teamOf } = await loadGraphReader(g);
    const lead = reader.teamLeadOf("legal");
    expect(lead).toBeTruthy();
    expect(teamOf(lead!)).toBe("legal");
    enqueue.mockClear();
    const { stored } = await routeAndStore(db(), event, row.id, { graph: reader, prefs: { get: () => undefined }, now: 1_800_000_000, enqueue: enqueue as never });
    const rows = await db().select().from(notifications).where(and(eq(notifications.orgId, org.id), eq(notifications.kind, "campaign.chase")));
    expect(stored).toBe(rows.length);
    const high = rows.find((r) => r.body.reason === "chase");
    expect(high).toMatchObject({ personId: lead, urgency: "high" });
    expect(high!.body.subject).toEqual({ kind: "change", id: "d-1" }); // so the ledger of d-1 picks it up
    expect(enqueue.mock.calls.some((x) => x[0] === "deliver")).toBe(true);
  }, 30_000);
});
