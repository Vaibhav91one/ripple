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
  const rows = async () => {
    const { db } = await import("../db");
    const { events } = await import("../db/schema");
    const { eq } = await import("drizzle-orm");
    return db().select().from(events).where(eq(events.orgId, org.id));
  };
  const setup = async () => {
    const { db } = await import("../db");
    const { orgs } = await import("../db/schema");
    await db().insert(orgs).values({ id: org.id, slug: org.id, graphName: gname }).onConflictDoNothing();
  };

  it.skipIf(!dbUrl)("open, resolve, reopen: exactly two conflict.found events, re-detection none; each dispatches the Decision Advisor", async (c) => {
    if (!up) c.skip();
    const { emitConflictsFound } = await import("./conflicts");
    await setup();
    await changeSunset(g, "d-1", AFTER_GUARANTEE, NOW + 200); // resolved
    await emitConflictsFound(org.id, await changeSunset(g, "d-1", BEFORE_GUARANTEE, NOW + 300)); // open (episode 1)
    const [ev] = await rows();
    expect(ev).toMatchObject({ type: "conflict.found", dedupeKey: `conflict:${org.id}:conf-d-1-api-v1:${NOW + 300}`, payload: { changeId: "d-1", conflictsWith: "ctr-1" } });

    await emitConflictsFound(org.id, await detectConflicts(g, NOW + 400, "d-1")); // already open: nothing new
    expect(await rows()).toHaveLength(1);

    await changeSunset(g, "d-1", AFTER_GUARANTEE, NOW + 500); // resolved again
    await emitConflictsFound(org.id, await changeSunset(g, "d-1", BEFORE_GUARANTEE, NOW + 600)); // reopened (episode 2)
    expect((await rows()).map((r) => r.dedupeKey).sort()).toEqual([`conflict:${org.id}:conf-d-1-api-v1:${NOW + 300}`, `conflict:${org.id}:conf-d-1-api-v1:${NOW + 600}`]);

    const enqueue = vi.fn(async (_n: "agent", _d: object) => "job");
    expect(await dispatchAgents({ type: "conflict.found", orgId: org.id, payload: ev.payload as { changeId: string } }, enqueue)).toEqual(["advisor"]);
    expect(enqueue.mock.calls[0][1]).toMatchObject({ agent: "advisor", input: { decisionId: "d-1" } });
  }, 30_000);

  it.skipIf(!dbUrl)("approving a GUARANTEES edge that conflicts with d-1's sunset emits conflict.found once", async (c) => {
    if (!up) c.skip();
    const { db } = await import("../db");
    const { events } = await import("../db/schema");
    const { eq } = await import("drizzle-orm");
    const { applyProposal } = await import("../connectors/apply");
    await setup();
    await db().delete(events).where(eq(events.orgId, org.id));
    await changeSunset(g, "d-1", AFTER_GUARANTEE, NOW + 700); // past both MSAs: no conflict
    expect((await detectConflicts(g, NOW + 710, "d-1")).data.filter((x) => x.status === "open")).toHaveLength(0);
    const guarantee = { op: "merge_edge", type: "GUARANTEES", from: { label: "Contract", id: "ctr-3" }, to: { label: "System", id: "api-v1" }, props: { until: Math.floor(Date.parse("2028-01-01T00:00:00Z") / 1000) }, src: "art-msa-northwind", confidence: 1, structured: true };
    expect(await applyProposal(g, guarantee, NOW + 800, org.id)).toEqual({ applied: true });
    const evs = await rows();
    expect(evs).toHaveLength(1);
    expect(evs[0]).toMatchObject({ type: "conflict.found", payload: { changeId: "d-1", conflictsWith: "ctr-3" } });
    await applyProposal(g, guarantee, NOW + 900, org.id); // the same edge again: still open, nothing new
    expect(await rows()).toHaveLength(1);
  }, 30_000);
});
