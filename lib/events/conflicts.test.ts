import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { closeClient, graphFor, query, type Graph } from "../graph/client";
import { changeSunset, detectConflicts } from "../graph/queries";
import { seed } from "../ingest/seed";
import { dispatchAgents } from "../../worker/handlers/route-event";

vi.mock("server-only", () => ({}));
vi.mock("../queue", () => ({ enqueue: vi.fn(async () => "job") }));

const dbUrl = process.env.DATABASE_URL;
const gname = `test_c_${randomUUID().replaceAll("-", "")}`;
const org = { id: `test-conf-${randomUUID()}` };
const NOW = Math.floor(Date.parse("2026-10-17T09:00:00Z") / 1000);
const BEFORE_GUARANTEE = Math.floor(Date.parse("2027-01-31T00:00:00Z") / 1000);
const AFTER_GUARANTEE = Math.floor(Date.parse("2027-08-01T00:00:00Z") / 1000);
let g: Graph;
let up = false;

beforeAll(async () => {
  try {
    g = await graphFor(gname);
    await query(g, "RETURN 1");
    await seed(gname);
    up = true;
  } catch (e) {
    console.warn(`SKIPPING conflict event tests: FalkorDB unreachable (${String(e)})`);
  }
}, 30_000);
afterAll(async () => {
  if (up) await g.delete();
  await closeClient();
  if (!dbUrl) return;
  const { db } = await import("../db");
  const { events, orgs } = await import("../db/schema");
  const { eq } = await import("drizzle-orm");
  await db().delete(events).where(eq(events.orgId, org.id));
  await db().delete(orgs).where(eq(orgs.id, org.id));
});

describe("detectConflicts reports what is new", () => {
  it("re-running detection creates nothing; moving the date into a guarantee window creates the conflict", async (c) => {
    if (!up) c.skip();
    expect((await detectConflicts(g, NOW, "d-1")).created).toEqual([]); // the seed already holds it
    expect((await changeSunset(g, "d-1", AFTER_GUARANTEE, NOW)).created).toEqual([]); // past the guarantee: resolved, nothing new
    const moved = await changeSunset(g, "d-1", BEFORE_GUARANTEE, NOW + 60); // back inside the window
    expect(moved.created).toEqual(["conf-d-1-api-v1"]);
    expect((await detectConflicts(g, NOW + 120, "d-1")).created).toEqual([]);
  }, 30_000);
});

describe("conflict.found (Postgres)", () => {
  it.skipIf(!dbUrl)("a new conflict emits conflict.found once and dispatches the Decision Advisor", async (c) => {
    if (!up) c.skip();
    const { db } = await import("../db");
    const { events, orgs } = await import("../db/schema");
    const { eq } = await import("drizzle-orm");
    const { emitConflictsFound } = await import("./conflicts");
    await db().insert(orgs).values({ id: org.id, slug: org.id, graphName: gname }).onConflictDoNothing();
    await changeSunset(g, "d-1", AFTER_GUARANTEE, NOW + 200);
    const created = await changeSunset(g, "d-1", BEFORE_GUARANTEE, NOW + 300);
    await emitConflictsFound(org.id, created);
    const rows = () => db().select().from(events).where(eq(events.orgId, org.id));
    const [ev] = await rows();
    expect(ev).toMatchObject({ type: "conflict.found", dedupeKey: `conflict:${org.id}:conf-d-1-api-v1`, payload: { changeId: "d-1", conflictsWith: "ctr-1" } });

    const again = await detectConflicts(g, NOW + 400, "d-1"); // nothing new: nothing to emit
    await emitConflictsFound(org.id, again);
    await emitConflictsFound(org.id, created); // even a repeated call dedupes on the key
    expect(await rows()).toHaveLength(1);

    const enqueue = vi.fn(async (_n: "agent", _d: object) => "job");
    expect(await dispatchAgents({ type: "conflict.found", orgId: org.id, payload: ev.payload as { changeId: string } }, enqueue)).toEqual(["advisor"]);
    expect(enqueue.mock.calls[0][1]).toMatchObject({ agent: "advisor", input: { decisionId: "d-1" } });
  }, 30_000);
});
