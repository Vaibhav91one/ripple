import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { closeClient, graphFor, query, type Graph } from "../graph/client";
import { defineConnector, type GraphProposal } from "./define";

vi.mock("server-only", () => ({}));
vi.mock("../queue", () => ({ enqueue: vi.fn(async () => "job") }));

const dbUrl = process.env.DATABASE_URL;
const gname = `test_c_${randomUUID().replaceAll("-", "")}`;
const orgId = `test-conn-${randomUUID()}`;
let g: Graph;
let accountId: string;
let failPage2 = true;

const person = (n: number): GraphProposal => ({ op: "merge_node", label: "Person", id: `p-${n}`, props: { name: `P${n}` }, src: `fake:${n}`, confidence: 1, structured: true });
const fake = defineConnector({
  kind: "fake",
  auth: "apikey",
  async *sync(_acct, cursor) {
    if (cursor === null) yield { records: [1, 2], nextCursor: "c1" };
    if (cursor !== "c2") {
      if (failPage2) throw new Error("network down");
      yield { records: [3, 4], nextCursor: "c2" };
    }
  },
  map: (n) => [
    person(n as number),
    { op: "merge_node", label: "Task", id: `t-${n}`, props: { title: `T${n}` }, src: `fake:${n}`, quote: "inferred", confidence: 0.6, structured: false },
  ],
  webhook: async (req, acct) => {
    if (req.headers.get("x-sig") !== "ok") throw new Error("bad signature");
    const id = req.headers.get("x-delivery") ?? "";
    return [{ type: "pr.opened", orgId: acct.orgId, subject: { kind: "pr", id }, payload: { url: "https://example.com/pr/1" }, dedupeKey: `fake:${id}` }];
  },
});

const idsOf = async (label: string) => (await query<{ id: string }>(g, `MATCH (n:${label}) RETURN n.id AS id ORDER BY n.id`)).map((r) => r.id);
const accountRow = async () => {
  const { db } = await import("../db");
  const { connectorAccounts } = await import("../db/schema");
  const { eq } = await import("drizzle-orm");
  return (await db().select().from(connectorAccounts).where(eq(connectorAccounts.id, accountId)))[0];
};

describe.skipIf(!dbUrl)("connector framework (Postgres + FalkorDB)", () => {
  beforeAll(async () => {
    g = await graphFor(gname);
    await query(g, "RETURN 1");
    const { db } = await import("../db");
    const { orgs, connectorAccounts } = await import("../db/schema");
    await db().insert(orgs).values({ id: orgId, slug: orgId, graphName: gname, isDemo: false });
    [{ id: accountId }] = await db().insert(connectorAccounts).values({ orgId, kind: "fake", externalId: "ext-1", scopes: ["read"] }).returning({ id: connectorAccounts.id });
  }, 30_000);
  afterAll(async () => {
    await g?.delete();
    await closeClient();
    const { db } = await import("../db");
    const { orgs, pendingActions, auditLog, events } = await import("../db/schema");
    const { eq } = await import("drizzle-orm");
    for (const t of [pendingActions, auditLog, events]) await db().delete(t).where(eq(t.orgId, orgId));
    await db().delete(orgs).where(eq(orgs.id, orgId)); // cascades the connector_account
  });

  it("an interrupted sync keeps the page-1 cursor and the next run resumes after it", async () => {
    const { runSync } = await import("./sync");
    await expect(runSync(accountId, { graph: g, connector: fake })).rejects.toThrow("network down");
    let row = await accountRow();
    expect(row.cursor).toBe("c1");
    expect(row.status).toBe("error");
    expect(await idsOf("Person")).toEqual(["p-1", "p-2"]);

    failPage2 = false;
    const seen: unknown[] = [];
    const spy = defineConnector({ ...fake, sync: (a, c) => (seen.push(c), fake.sync!(a, c)) });
    expect(await runSync(accountId, { graph: g, connector: spy })).toMatchObject({ pages: 1, applied: 2, proposed: 2 });
    expect(seen).toEqual(["c1"]); // resumed, not restarted
    row = await accountRow();
    expect(row).toMatchObject({ cursor: "c2", status: "active" });
    expect(row.lastSyncAt).not.toBeNull();
    expect(await idsOf("Person")).toEqual(["p-1", "p-2", "p-3", "p-4"]);
  });

  it("structured proposals were audited; unstructured ones wait as pending graph_merge actions", async () => {
    const { db } = await import("../db");
    const { auditLog, pendingActions } = await import("../db/schema");
    const { and, eq } = await import("drizzle-orm");
    const writes = await db().select().from(auditLog).where(and(eq(auditLog.orgId, orgId), eq(auditLog.action, "connector.graph_write")));
    expect(writes.length).toBeGreaterThanOrEqual(4);
    expect(writes[0]).toMatchObject({ resourceType: "connector_account", resourceId: accountId });
    expect(await idsOf("Task")).toEqual([]); // nothing inferred reaches the graph unapproved
    const pending = await db().select().from(pendingActions).where(and(eq(pendingActions.orgId, orgId), eq(pendingActions.kind, "graph_merge")));
    expect(pending.length).toBe(4);
    expect(new Set(pending.map((p) => p.status))).toEqual(new Set(["pending"]));

    // approving one runs it through the shared writer
    await db().update(pendingActions).set({ status: "approved" }).where(eq(pendingActions.id, pending[0].id));
    const { executeAction } = await import("../actions/execute");
    expect(await executeAction(pending[0].id, g)).toBe("executed");
    expect(await idsOf("Task")).toHaveLength(1);
  });

  it("a structured edge with a missing endpoint is skipped, counted and reported in the sync result", async () => {
    const { runSync } = await import("./sync");
    const edgeOnly = defineConnector({
      ...fake,
      sync: async function* () { yield { records: [1], nextCursor: "e1" }; },
      map: () => [{ op: "merge_edge", type: "KNOWS", from: { label: "Person", id: "p-1" }, to: { label: "Person", id: "p-nope" }, src: "fake:e", confidence: 1, structured: true, props: {} }],
    });
    expect(await runSync(accountId, { graph: g, connector: edgeOnly })).toMatchObject({ applied: 0, skipped: 1 });
  });

  it("a bad label or edge type never reaches Cypher", async () => {
    const { applyProposal } = await import("./apply");
    await expect(applyProposal(g, { ...person(9), label: "Person) DETACH DELETE (x" }, 1)).rejects.toThrow();
    await expect(applyProposal(g, { op: "merge_edge", type: "X]->() DELETE n //", from: { label: "Person", id: "p-1" }, to: { label: "Person", id: "p-2" }, src: "s", confidence: 1, structured: true, props: {} }, 1)).rejects.toThrow();
    await applyProposal(g, { op: "merge_edge", type: "KNOWS", from: { label: "Person", id: "p-1" }, to: { label: "Person", id: "p-2" }, src: "s", confidence: 1, structured: true, props: {} }, 5);
    const live = () => query(g, "MATCH (:Person {id:'p-1'})-[r:KNOWS]->(:Person {id:'p-2'}) WHERE r.endedAt IS NULL RETURN r.src AS src");
    expect(await live()).toHaveLength(1);
    await applyProposal(g, { op: "end_edge", type: "KNOWS", from: { label: "Person", id: "p-1" }, to: { label: "Person", id: "p-2" }, src: "s", confidence: 1, structured: true, props: {} }, 6);
    expect(await live()).toHaveLength(0);
  });

  it("webhook: bad signature is 400, a redelivery with the same delivery id is stored once", async () => {
    const { handleWebhook } = await import("./webhook");
    const post = (headers: Record<string, string>) => handleWebhook(fake, accountId, new Request("http://x/api/connectors/fake/webhook", { method: "POST", headers, body: "{}" }));
    expect((await post({ "x-sig": "nope", "x-delivery": "d1" })).status).toBe(400);
    const first = await (await post({ "x-sig": "ok", "x-delivery": "d1" })).json();
    const again = await (await post({ "x-sig": "ok", "x-delivery": "d1" })).json();
    const other = await (await post({ "x-sig": "ok", "x-delivery": "d2" })).json();
    expect([first.inserted, again.inserted, other.inserted]).toEqual([1, 0, 1]);
    expect((await handleWebhook(fake, randomUUID(), new Request("http://x", { method: "POST" }))).status).toBe(404);
    const { db } = await import("../db");
    const { events } = await import("../db/schema");
    const { and, eq } = await import("drizzle-orm");
    expect(await db().select().from(events).where(and(eq(events.orgId, orgId), eq(events.type, "pr.opened")))).toHaveLength(2);
  });
});
