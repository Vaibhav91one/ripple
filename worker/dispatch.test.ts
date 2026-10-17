import { describe, expect, it, vi } from "vitest";
import { fanOut } from "./handlers/agent-cron";
import { dispatchAgents } from "./handlers/route-event";

vi.mock("server-only", () => ({}));

describe("route-event -> agent jobs", () => {
  it("change.confirmed queues the Impact Analyst and the Contract Sentinel with the decision id", async () => {
    const enqueue = vi.fn(async (_n: string, _d: object) => "job");
    const names = await dispatchAgents({ type: "change.confirmed", orgId: "o1", payload: { changeId: "d-1" } }, enqueue);
    expect(names.sort()).toEqual(["contract", "impact"]);
    expect(enqueue.mock.calls.map((c) => c[1])).toEqual(expect.arrayContaining([
      { orgId: "o1", agent: "impact", trigger: "event:change.confirmed", input: { reason: "change.confirmed", decisionId: "d-1", contractId: null } },
      { orgId: "o1", agent: "contract", trigger: "event:change.confirmed", input: { reason: "change.confirmed", decisionId: "d-1", contractId: null } },
    ]));
  });
  it("change.updated is impact only, contract.added is the Sentinel only, other events queue nothing", async () => {
    const enqueue = vi.fn(async (_n: string, _d: object) => "job");
    expect(await dispatchAgents({ type: "change.updated", orgId: "o", payload: { changeId: "d-1" } }, enqueue)).toEqual(["impact"]);
    expect(await dispatchAgents({ type: "contract.added", orgId: "o", payload: { contractId: "ctr-9" } }, enqueue)).toEqual(["contract"]);
    expect(enqueue.mock.calls.at(-1)![1]).toMatchObject({ agent: "contract", input: { decisionId: null, contractId: "ctr-9" } });
    enqueue.mockClear();
    expect(await dispatchAgents({ type: "task.due", orgId: "o", payload: { taskId: "t" } }, enqueue)).toEqual([]);
    expect(enqueue).not.toHaveBeenCalled();
  });
});

describe("agent-cron fan-out", () => {
  const orgs = async () => [{ id: "acme", isDemo: false }, { id: "demo", isDemo: true }, { id: "globex", isDemo: false }];
  it("one agent job per org, the demo excluded", async () => {
    const enqueue = vi.fn(async (_n: string, _d: object) => "job");
    expect(await fanOut("contract", { orgs, enqueue, demoAgents: false })).toEqual(["acme", "globex"]);
    expect(enqueue.mock.calls.map((c) => c[1])).toEqual([
      { orgId: "acme", agent: "contract", trigger: "cron", input: { reason: "cron", decisionId: null, contractId: null } },
      { orgId: "globex", agent: "contract", trigger: "cron", input: { reason: "cron", decisionId: null, contractId: null } },
    ]);
  });
  it("RIPPLE_DEMO_AGENTS=1 includes the demo", async () => {
    expect(await fanOut("contract", { orgs, enqueue: vi.fn(async () => 0), demoAgents: true })).toEqual(["acme", "demo", "globex"]);
  });
});

const url = process.env.DATABASE_URL;
describe.skipIf(!url)("agent cron schedule (Postgres)", () => {
  it("starting the worker twice leaves one keyed schedule per cron agent", async () => {
    process.env.PGBOSS_SCHEMA = `test_boss_${crypto.randomUUID().replaceAll("-", "").slice(0, 12)}`;
    const { startWorker } = await import("./index");
    const { queue } = await import("../lib/queue");
    const stop1 = await startWorker(url!, { "agent-cron": async () => {} });
    await stop1();
    const stop2 = await startWorker(url!, { "agent-cron": async () => {} });
    const sched = (await (await queue())!.getSchedules("agent-cron")).filter((s) => s.key === "contract");
    expect(sched).toHaveLength(1);
    expect(sched[0].cron).toBe("0 6 * * *");
    await stop2();
    await (await queue())!.stop({ graceful: false });
    const sql = (await import("postgres")).default(url!, { max: 1, onnotice: () => {} });
    await sql.unsafe(`DROP SCHEMA IF EXISTS ${process.env.PGBOSS_SCHEMA} CASCADE`);
    await sql.end();
    delete process.env.PGBOSS_SCHEMA;
  }, 30_000);
});
