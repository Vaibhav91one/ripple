import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { closeClient, graphFor, query, type Graph } from "../graph/client";
import { seed } from "../ingest/seed";

vi.mock("server-only", () => ({}));
const enqueue = vi.fn<(name: string, data: object, opts?: object) => Promise<string>>(async () => "job");
const executions = () => enqueue.mock.calls.filter((c) => c[0] === "execute-action").length;
vi.mock("../queue", () => ({ enqueue }));

const dbUrl = process.env.DATABASE_URL;
const gname = `test_a_${randomUUID().replaceAll("-", "")}`;
const org = { id: `test-act-${randomUUID()}` };
let g: Graph;
let graphUp = false;

beforeAll(async () => {
  if (!dbUrl) return;
  try {
    g = await graphFor(gname);
    await query(g, "RETURN 1");
    await seed(gname);
    graphUp = true;
  } catch (e) {
    console.warn(`SKIPPING action tests: FalkorDB unreachable (${String(e)})`);
  }
}, 30_000);
afterAll(async () => {
  if (graphUp) await g.delete();
  await closeClient();
  if (!dbUrl) return;
  const { db } = await import("../db");
  const { pendingActions, orgPolicy, auditLog, events } = await import("../db/schema");
  const { eq } = await import("drizzle-orm");
  for (const t of [pendingActions, orgPolicy, auditLog, events]) await db().delete(t).where(eq(t.orgId, org.id));
  const { orgs } = await import("../db/schema");
  await db().delete(orgs).where(eq(orgs.id, org.id));
});

const proposer = { org, viewer: { kind: "agent", id: "a" } };
const user = (role: string, id = "u1") => ({ org, viewer: { kind: "user", id, role } });
const task = (n: string) => ({ id: `task-${n}`, teamId: "legal", decisionId: "d-1", title: "Review", body: "b" });
const row = async (id: string) => {
  const { db } = await import("../db");
  const { pendingActions } = await import("../db/schema");
  const { eq } = await import("drizzle-orm");
  return (await db().select().from(pendingActions).where(eq(pendingActions.id, id)))[0];
};
const audits = async (action: string) => {
  const { db } = await import("../db");
  const { auditLog } = await import("../db/schema");
  const { and, eq } = await import("drizzle-orm");
  return db().select().from(auditLog).where(and(eq(auditLog.orgId, org.id), eq(auditLog.action, action)));
};
const tasksIn = async (id: string) => query(g, "MATCH (k:Task {id: $id}) RETURN k.id AS id", { id });

describe("agent tools never write directly", () => {
  it("tools.ts has no query() call (roQuery only)", () => {
    expect(readFileSync("lib/agent/tools.ts", "utf8")).not.toMatch(/(?<![A-Za-z])query\(/);
  });
});

describe.skipIf(!dbUrl)("pending actions (Postgres + FalkorDB)", () => {
  it("approving twice executes once", async (c) => {
    if (!graphUp) c.skip();
    const { propose } = await import("./propose");
    const { approve } = await import("./decide");
    const { executeAction } = await import("./execute");
    enqueue.mockClear();
    const p = await propose(proposer, "create_task", task("once"), [{ q: "x" }]);
    expect(p.status).toBe("pending");
    expect((await propose(proposer, "create_task", task("once"))).created).toBe(false); // same proposal, same row
    expect(await approve(user("lead"), p.id)).toMatchObject({ status: "approved", changed: true });
    expect(await approve(user("lead", "u2"), p.id)).toMatchObject({ changed: false });
    expect(executions()).toBe(1);
    // even if the queue delivers twice, the executor runs once
    const results = await Promise.all([executeAction(p.id, g), executeAction(p.id, g)]);
    expect(results.sort()).toEqual(["executed", "skipped"]);
    expect(await tasksIn("task-once")).toHaveLength(1);
    expect(await row(p.id)).toMatchObject({ status: "executed", approver: "u1" });
    expect((await audits("action.executed")).length).toBeGreaterThan(0);
  }, 30_000);

  it("auto-approve policy is honoured; the default is manual", async () => {
    const { db } = await import("../db");
    const { orgPolicy } = await import("../db/schema");
    const { propose } = await import("./propose");
    const { eq } = await import("drizzle-orm");
    await db().insert(orgPolicy).values({ orgId: org.id, actionKind: "graph_merge", autoApprove: true });
    enqueue.mockClear();
    const auto = await propose(proposer, "graph_merge", { label: "Task", id: "task-auto" });
    expect(auto.status).toBe("approved");
    expect(await row(auto.id)).toMatchObject({ approver: "policy" });
    expect(executions()).toBe(1);
    expect((await propose(proposer, "create_task", task("manual"))).status).toBe("pending");
    await db().delete(orgPolicy).where(eq(orgPolicy.orgId, org.id));
  });

  it("reject never executes", async (c) => {
    if (!graphUp) c.skip();
    const { propose } = await import("./propose");
    const { reject, approve } = await import("./decide");
    const { executeAction } = await import("./execute");
    enqueue.mockClear();
    const p = await propose(proposer, "create_task", task("rej"));
    await reject(user("admin"), p.id);
    expect(await approve(user("admin"), p.id)).toMatchObject({ status: "rejected", changed: false });
    expect(await executeAction(p.id, g)).toBe("skipped");
    expect(executions()).toBe(0);
    expect(await tasksIn("task-rej")).toHaveLength(0);
  }, 30_000);

  it("a non-permitted approver gets 403 and an audit deny row", async () => {
    const { propose } = await import("./propose");
    const { approve, reject, ActionError } = await import("./decide");
    const p = await propose(proposer, "graph_merge", { label: "Task", id: "task-deny" });
    for (const who of [user("member"), user("lead"), { org, viewer: { kind: "agent", id: "a" } }]) {
      await expect(approve(who, p.id)).rejects.toMatchObject({ status: 403 });
    }
    await expect(reject(user("member"), p.id)).rejects.toBeInstanceOf(ActionError);
    expect((await audits("action.approve")).filter((a) => a.outcome === "deny").length).toBe(3);
    expect((await row(p.id)).status).toBe("pending");
    await expect(approve({ org: { id: "other" }, viewer: user("admin").viewer }, p.id)).rejects.toMatchObject({ status: 404 });
  });

  it("graph_merge rejects a label outside the allowlist and records the failure", async (c) => {
    if (!graphUp) c.skip();
    const { propose } = await import("./propose");
    const { approve } = await import("./decide");
    const { executeAction } = await import("./execute");
    const p = await propose(proposer, "graph_merge", { label: "Decision) DETACH DELETE (n", id: "x" });
    await approve(user("admin"), p.id);
    expect(await executeAction(p.id, g)).toBe("failed");
    expect((await row(p.id)).status).toBe("failed");
  }, 30_000);

  it("create_tasks proposes one create_task per gap team and writes nothing", async (c) => {
    if (!graphUp) c.skip();
    const { TOOLS } = await import("../agent/tools");
    const propose = vi.fn<(kind: string, payload: unknown, evidence?: unknown) => Promise<{ id: string; status: string; created: boolean }>>(async () => ({ id: "p", status: "pending", created: true }));
    const out = await TOOLS.create_tasks.run({ g, now: 1_800_000_000, demo: false, propose }, { decisionId: "d-1" });
    expect(propose).toHaveBeenCalled();
    expect(propose.mock.calls.every((a) => a[0] === "create_task")).toBe(true);
    expect(out.rows).toHaveLength(propose.mock.calls.length);
    expect(await query(g, "MATCH (k:Task) WHERE k.id STARTS WITH 'task-d-1' RETURN k.id AS id")).toHaveLength(0);
  }, 30_000);

  it("an approved draft_doc becomes a document and a Doc linked ABOUT the contract and the decision", async (c) => {
    if (!graphUp) c.skip();
    const { db } = await import("../db");
    const { orgs, documents, agentRuns } = await import("../db/schema");
    const { and, eq } = await import("drizzle-orm");
    const { propose } = await import("./propose");
    const { approve } = await import("./decide");
    const { executeAction } = await import("./execute");
    const d = db();
    await d.insert(orgs).values({ id: org.id, slug: org.id, graphName: gname }).onConflictDoNothing();
    const [run] = await d.insert(agentRuns).values({ orgId: org.id, agent: "contract", trigger: "manual", input: {} }).returning({ id: agentRuns.id });
    const draft = { kind: "notice", contractId: "ctr-1", decisionId: "d-1", title: "Notice of API v1 retirement: Northwind", body: "Clause 7.2: Ledgerly guarantees availability of API v1 until 2027-06-30." };
    const p = await propose({ ...proposer, runId: run.id }, "draft_doc", draft);
    await approve(user("lead", "u-lead"), p.id);
    expect(await executeAction(p.id, g)).toBe("executed");
    const result = (await row(p.id)).result as { documentId: string };
    const [doc] = await d.select().from(documents).where(and(eq(documents.orgId, org.id), eq(documents.id, result.documentId)));
    expect(doc).toMatchObject({ title: draft.title, text: draft.body });
    const node = await query<{ author: string; approvedBy: string; text: string; about: string[] }>(g,
      "MATCH (a:Doc:Artifact {id: $id}) OPTIONAL MATCH (a)-[:ABOUT]->(x) RETURN a.author AS author, a.approvedBy AS approvedBy, a.text AS text, collect(x.id) AS about", { id: result.documentId });
    expect(node[0]).toMatchObject({ author: "agent:contract", approvedBy: "u-lead", text: draft.body });
    expect([...node[0].about].sort()).toEqual(["ctr-1", "d-1"]);
    expect(await query(g, "CALL db.idx.fulltext.queryNodes('Artifact', 'guarantees') YIELD node RETURN node.id AS id")).toEqual(expect.arrayContaining([{ id: result.documentId }]));
    await d.delete(documents).where(eq(documents.orgId, org.id));
    await d.delete(agentRuns).where(eq(agentRuns.orgId, org.id));
  }, 30_000);

  it("an approved access_request opens an AccessRequest + access.needed; IT granting it closes the gap + access.granted, and only a lead may", async (c) => {
    if (!graphUp) c.skip();
    const { db } = await import("../db");
    const { orgs, events } = await import("../db/schema");
    const { and, eq } = await import("drizzle-orm");
    const { propose } = await import("./propose");
    const { approve } = await import("./decide");
    const { executeAction } = await import("./execute");
    const { decideIt, computeIt } = await import("../it");
    const d = db();
    await d.insert(orgs).values({ id: org.id, slug: org.id, graphName: gname }).onConflictDoNothing();
    await query(g, "MERGE (:AccessGroup {id: 'group:v2-console', name: 'v2 console'})");
    const NOW = 1_800_000_000;
    const body = { id: "ar-d-1-p-nia-v2", personId: "p-nia", teamId: "support", resourceId: "group:v2-console", resourceKind: "group", decisionId: "d-1", justification: "Nia needs the v2 console.", src: "art-rfc14", quote: "API v1 will be shut down on Jan 31, 2027", expiresAt: NOW + 90 * 86400, approvers: ["eng", "it"] };
    const p = await propose(proposer, "access_request", body);
    await approve(user("lead", "u-lead"), p.id);
    expect(await executeAction(p.id, g)).toBe("executed");
    const evs = async (type: string) => d.select().from(events).where(and(eq(events.orgId, org.id), eq(events.type, type)));
    expect((await evs("access.needed"))[0]).toMatchObject({ subjectId: body.id, payload: { userId: "p-nia", resource: "group:v2-console" } });
    const node = await query<{ status: string; deadline: number; team: string; ok: boolean }>(g, "MATCH (a:AccessRequest {id: $id})-[:FOR]->(p:Person) RETURN a.status AS status, a.deadline AS deadline, a.teamId AS team, a.approvers = ['eng', 'it'] AS ok", { id: body.id });
    expect(node[0]).toMatchObject({ status: "open", deadline: 1801386000, team: "support", ok: true });
    // the queue shows it, earliest change date first, and Ripple holds no grant of its own
    const ctx = (role: string) => ({ viewer: { kind: "user", userId: "it-1", orgId: org.id, teamIds: [], role }, org: { id: org.id, graphName: gname, isDemo: false }, readonly: false, graph: g, now: NOW, audit: async () => {}, writer: () => g }) as never;
    expect((await computeIt(ctx("lead"))).requests[0]).toMatchObject({ id: body.id, status: "open", personName: "Nia", resourceName: "v2 console", deadline: 1801386000 });
    expect(await query(g, "MATCH (:Person {id: 'p-nia'})-[h:HAS_ACCESS]->(:AccessGroup {id: 'group:v2-console'}) RETURN h")).toHaveLength(0);
    await expect(decideIt(ctx("member"), [body.id], "grant")).rejects.toThrow(/only an admin or team lead/);
    expect(await decideIt(ctx("lead"), [body.id], "grant")).toEqual({ decided: [body.id], status: "granted" });
    expect(await decideIt(ctx("lead"), [body.id], "deny")).toEqual({ decided: [], status: "denied" }); // already decided: a no-op
    expect(await query(g, "MATCH (:Person {id: 'p-nia'})-[h:HAS_ACCESS]->(:AccessGroup {id: 'group:v2-console'}) RETURN h")).toHaveLength(1);
    expect((await evs("access.granted"))[0]).toMatchObject({ subjectId: body.id, payload: { userId: "p-nia" } });
    expect((await computeIt(ctx("lead"))).requests[0]).toMatchObject({ status: "granted", decidedBy: "it-1" });
    await d.delete(events).where(eq(events.orgId, org.id));
  }, 30_000);
});
