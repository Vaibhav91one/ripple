import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { closeClient, graphFor, query, type Graph } from "../graph/client";
import { seed } from "../ingest/seed";
import { dispatchAgents } from "../../worker/handlers/route-event";

vi.mock("server-only", () => ({}));
vi.mock("../queue", () => ({ enqueue: vi.fn(async () => "job") }));

const gname = `test_m_${randomUUID().replaceAll("-", "")}`;
const NOW = Math.floor(Date.parse("2026-10-17T09:00:00Z") / 1000);
const AFTER = Math.floor(Date.parse("2027-02-01T00:00:00Z") / 1000);
let g: Graph;
let up = false;

beforeAll(async () => {
  try {
    g = await graphFor(gname);
    await query(g, "RETURN 1");
    await seed(gname);
    up = true;
  } catch (e) {
    console.warn(`SKIPPING member-added tests: FalkorDB unreachable (${String(e)})`);
  }
}, 30_000);
afterAll(async () => {
  if (up) await g.delete();
  await closeClient();
});

const joined = (teamId: string) => ({ type: "team.member_added" as const, orgId: "o1", payload: { teamId, personId: "p-nia" } });

describe("team.member_added -> Access Planner", () => {
  it("queues the planner for each open change reaching the team, scoped to the new person", async (c) => {
    if (!up) c.skip();
    const enqueue = vi.fn(async (_n: "agent", _d: object) => "job");
    expect(await dispatchAgents(joined("support"), enqueue, g, NOW)).toEqual(["access"]);
    expect(enqueue.mock.calls.map((x) => x[1])).toEqual([
      { orgId: "o1", agent: "access", trigger: "event:team.member_added", input: { reason: "team.member_added", decisionId: "d-1", personId: "p-nia" } },
    ]);
  }, 30_000);
  it("queues nothing for an unaffected team, or once the change is past its effective date", async (c) => {
    if (!up) c.skip();
    const enqueue = vi.fn(async (_n: "agent", _d: object) => "job");
    expect(await dispatchAgents(joined("no-such-team"), enqueue, g, NOW)).toEqual([]);
    expect(await dispatchAgents(joined("support"), enqueue, g, AFTER)).toEqual([]);
    expect(enqueue).not.toHaveBeenCalled();
  }, 30_000);
});

describe.skipIf(!process.env.DATABASE_URL)("team.member_added emit (Postgres)", () => {
  it("one event per person and team: a repeat is a no-op", async () => {
    const { db } = await import("../db");
    const { events } = await import("../db/schema");
    const { eq } = await import("drizzle-orm");
    const { emitMemberAdded } = await import("./emit");
    const orgId = `test-mem-${randomUUID()}`;
    try {
      await emitMemberAdded(db(), orgId, "p-nia", ["support", "eng"], "u1");
      await emitMemberAdded(db(), orgId, "p-nia", ["support"], "u1");
      const rows = await db().select().from(events).where(eq(events.orgId, orgId));
      expect(rows.map((r) => r.dedupeKey).sort()).toEqual([`member:${orgId}:eng:p-nia`, `member:${orgId}:support:p-nia`]);
    } finally {
      await db().delete(events).where(eq(events.orgId, orgId));
    }
  });
});
