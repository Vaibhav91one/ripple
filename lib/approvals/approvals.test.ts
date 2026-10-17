// Approve / reject / bulk-approve, 403s, the admin-only auto-approve switch (audited) and run detail, against Postgres.
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { closeClient, graphFor, type Graph } from "../graph/client";
import { seed } from "../ingest/seed";

vi.mock("server-only", () => ({}));
const enqueue = vi.fn<(name: string, data: object, opts?: object) => Promise<string>>(async () => "job");
vi.mock("../queue", () => ({ enqueue }));

const dbUrl = process.env.DATABASE_URL;
const org = { id: `test-appr-${randomUUID()}`, graphName: `test_ap_${randomUUID().replaceAll("-", "")}`, isDemo: false };
let g: Graph;
let who: { kind: "user" | "anon"; userId: string; role: string; orgId: string; teamIds: string[] } = { kind: "user", userId: "u1", role: "admin", orgId: org.id, teamIds: [] };
const audits: { action: string; outcome?: string; meta?: unknown }[] = [];

vi.mock("../server/context", () => ({
  getContext: async () => ({
    viewer: who, org, readonly: who.kind === "anon", graph: g, now: 0, writer: () => g,
    audit: async (ev: { action: string; outcome?: string; meta?: unknown }) => void audits.push(ev),
  }),
}));

const call = (route: string, method: "GET" | "POST" | "PATCH", url: string, body?: unknown, params: object = {}) =>
  import(`../../app/api/${route}/route`).then((m) => (m[method] as (r: Request, c: unknown) => Promise<Response>)(
    new Request(`http://t${url}`, { method, body: body ? JSON.stringify(body) : undefined }), { params: Promise.resolve(params) }));

const asUser = (role: string, userId = "u1") => void (who = { kind: "user", userId, role, orgId: org.id, teamIds: [] });

beforeAll(async () => {
  if (!dbUrl) return;
  g = await graphFor(org.graphName);
  await seed(org.graphName);
}, 30_000);
afterAll(async () => {
  if (g) await g.delete();
  await closeClient();
  if (!dbUrl) return;
  const { db } = await import("../db");
  const t = await import("../db/schema");
  const { eq } = await import("drizzle-orm");
  for (const x of [t.pendingActions, t.orgPolicy, t.auditLog, t.agentRuns, t.agentSettings, t.events]) await db().delete(x).where(eq(x.orgId, org.id));
});

const proposeMany = async (n: number, src = "upload:msa.pdf") => {
  const { propose } = await import("../actions/propose");
  const ids: string[] = [];
  for (let i = 0; i < n; i++)
    ids.push((await propose({ org, viewer: { kind: "agent", id: "a" } }, "graph_merge", { op: "merge_node", label: "Task", id: `t-${randomUUID()}`, props: {}, src, quote: "q", confidence: 0.9, structured: false }, [{ src, quote: "q" }])).id);
  return ids;
};
const status = async (id: string) => {
  const { db } = await import("../db");
  const { pendingActions } = await import("../db/schema");
  const { eq } = await import("drizzle-orm");
  return (await db().select().from(pendingActions).where(eq(pendingActions.id, id)))[0].status;
};

describe.skipIf(!dbUrl)("approvals (Postgres)", () => {
  it("lists what the role may decide, with a bulk group", async () => {
    const ids = await proposeMany(3);
    const { propose } = await import("../actions/propose");
    await propose({ org, viewer: { kind: "agent" } }, "create_task", { id: "x", teamId: "legal", decisionId: "d-1", title: "T", body: "b" });
    asUser("admin");
    const admin = await (await call("approvals", "GET", "/api/approvals")).json();
    expect(admin.open).toBe(4);
    const merges = admin.approvals.filter((a: { kind: string }) => a.kind === "graph_merge");
    expect(merges).toHaveLength(3);
    expect(merges[0]).toMatchObject({ groupSize: 3, group: "upload:msa.pdf", proposer: "upload", canDecide: true, summary: expect.stringMatching(/^Add Task t-/) });
    asUser("lead"); // leads decide tasks, not graph changes
    const lead = await (await call("approvals", "GET", "/api/approvals")).json();
    expect(lead.approvals.map((a: { kind: string }) => a.kind)).toEqual(["create_task"]);
    asUser("member");
    expect((await (await call("approvals", "GET", "/api/approvals")).json()).approvals).toEqual([]);
    expect(ids).toHaveLength(3);
  });

  it("a non-permitted approver gets 403; the action stays pending", async () => {
    const [id] = await proposeMany(1, "upload:deny.pdf");
    asUser("lead");
    const res = await call("approvals/[id]", "POST", `/api/approvals/${id}`, { decision: "approve" }, { id });
    expect(res.status).toBe(403);
    expect(await status(id)).toBe("pending");
    asUser("member");
    expect((await call("approvals/[id]", "POST", `/api/approvals/${id}`, { decision: "reject" }, { id })).status).toBe(403);
  });

  it("approve, reject and bulk-approve end to end", async () => {
    const [a, b] = await proposeMany(2, "upload:one.pdf");
    const bulk = await proposeMany(4, "upload:bulk.pdf");
    asUser("admin");
    enqueue.mockClear();
    const ok = await call("approvals/[id]", "POST", `/api/approvals/${a}`, { decision: "approve", note: "looks right" }, { id: a });
    expect(ok.status).toBe(200);
    expect(await status(a)).toBe("approved");
    expect(audits.some((x) => x.action === "action.note")).toBe(true);
    expect((await call("approvals/[id]", "POST", `/api/approvals/${b}`, { decision: "reject" }, { id: b })).status).toBe(200);
    expect(await status(b)).toBe("rejected");

    enqueue.mockClear();
    const res = await call("approvals/[id]", "POST", `/api/approvals/${bulk[0]}`, { decision: "approve", bulk: true }, { id: bulk[0] });
    expect((await res.json()).results).toHaveLength(4);
    for (const id of bulk) expect(await status(id)).toBe("approved");
    expect(enqueue.mock.calls.filter((c) => c[0] === "execute-action")).toHaveLength(4);

    const done = await (await call("approvals", "GET", "/api/approvals?scope=decided")).json();
    expect(done.approvals.length).toBeGreaterThanOrEqual(6);
  });

  it("a failed action is listed with its error and can be approved again", async () => {
    const [id] = await proposeMany(1, "upload:fail.pdf");
    const { db } = await import("../db");
    const { pendingActions } = await import("../db/schema");
    const { eq } = await import("drizzle-orm");
    await db().update(pendingActions).set({ status: "failed", error: "boom" }).where(eq(pendingActions.id, id));
    asUser("admin");
    const list = await (await call("approvals", "GET", "/api/approvals")).json();
    expect(list.approvals.find((r: { id: string }) => r.id === id)).toMatchObject({ status: "failed", error: "boom", canDecide: true });
    expect((await call("approvals/[id]", "POST", `/api/approvals/${id}`, { decision: "approve" }, { id })).status).toBe(200);
    expect(await status(id)).toBe("approved");
  });

  it("the anonymous demo is read-only", async () => {
    const [id] = await proposeMany(1, "upload:anon.pdf");
    who = { kind: "anon", userId: "", role: "member", orgId: org.id, teamIds: [] };
    expect((await call("approvals/[id]", "POST", `/api/approvals/${id}`, { decision: "approve" }, { id })).status).toBe(403);
    expect(await status(id)).toBe("pending");
  });

  it("auto-approve and on/off are admin-only and audited", async () => {
    const { agents } = await import("../agent/registry");
    const def = agents().find((a) => a.writes.length) ?? agents()[0];
    const kind = def.writes[0];
    const patch = (body: unknown) => call("agents/[name]/settings", "PATCH", `/api/agents/${def.name}/settings`, body, { name: def.name });
    audits.length = 0;
    asUser("lead");
    expect((await patch({ enabled: false })).status).toBe(403);
    expect(audits).toContainEqual(expect.objectContaining({ action: "agent.settings", outcome: "deny" }));
    asUser("admin");
    expect((await patch({ enabled: false, ...(kind ? { autoApprove: { [kind]: true } } : {}) })).status).toBe(200);
    expect(audits).toContainEqual(expect.objectContaining({ action: "agent.settings", meta: expect.objectContaining({ enabled: false }) }));
    const list = await (await call("agents", "GET", "/api/agents")).json();
    const info = list.agents.find((a: { name: string }) => a.name === def.name);
    expect(list.canEdit).toBe(true);
    expect(info.enabled).toBe(false);
    if (kind) expect(info.autoApprove[kind]).toBe(true);
    expect((await patch({ autoApprove: { not_a_kind: true } })).status).toBe(400);
    if (kind) { // the switch is honoured: propose() now approves at once
      const { propose } = await import("../actions/propose");
      expect((await propose({ org, viewer: { kind: "agent" } }, kind, { op: "merge_node", label: "Task", id: "auto", props: {}, src: "s", confidence: 1, structured: true })).status).toBe("approved");
    }
    expect((await patch({ enabled: true })).status).toBe(200);
  });

  it("run detail shows tool calls, cypher, sources and the proposals it made", async () => {
    const { db } = await import("../db");
    const { agentRuns, runSteps, pendingActions } = await import("../db/schema");
    const [run] = await db().insert(agentRuns).values({ orgId: org.id, agent: "ask", trigger: "manual", input: {}, status: "done", output: { answer: "ok" }, tokens: 120, endedAt: new Date() }).returning();
    await db().insert(runSteps).values([
      { runId: run.id, n: 1, kind: "tool", tool: "who_is_affected", args: { decisionId: "d-1" }, cypher: ["// affected\nMATCH (n) RETURN n"], sourceIds: ["art-1"], tokens: 80 },
      { runId: run.id, n: 2, kind: "text", tokens: 40 },
    ]);
    await db().insert(pendingActions).values({ orgId: org.id, runId: run.id, kind: "create_task", payload: { title: "T" }, idempotencyKey: randomUUID() });
    asUser("admin");
    const detail = await (await call("agents/runs/[id]", "GET", `/api/agents/runs/${run.id}`, undefined, { id: run.id })).json();
    expect(detail.steps[0]).toMatchObject({ tool: "who_is_affected", cypher: [expect.stringContaining("MATCH")], sources: ["art-1"] });
    expect(detail.proposals).toMatchObject([{ kind: "create_task", summary: "Create task: T" }]);
    expect(detail.run).toMatchObject({ agent: "ask", proposals: 1, output: { answer: "ok" } });
    const runs = await (await call("agents/runs", "GET", "/api/agents/runs")).json();
    expect(runs.runs[0]).toMatchObject({ id: run.id, tokens: 120 });
    expect((await call("agents/runs/[id]", "GET", `/api/agents/runs/${randomUUID()}`, undefined, { id: randomUUID() })).status).toBe(404);
  });
});
