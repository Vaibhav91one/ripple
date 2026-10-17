import { describe, expect, it, vi } from "vitest";
import { digestFanOut, fanOut } from "./handlers/agent-cron";
import { dispatchAgents } from "./handlers/route-event";

vi.mock("server-only", () => ({}));

describe("route-event -> agent jobs", () => {
  it("change.confirmed queues Impact, Contract Sentinel, Customer Exposure, Access Planner and the Docs, Security and Support specialists with the decision id", async () => {
    const enqueue = vi.fn(async (_n: string, _d: object) => "job");
    const names = await dispatchAgents({ type: "change.confirmed", orgId: "o1", payload: { changeId: "d-1" } }, enqueue);
    expect(names.sort()).toEqual(["access", "contract", "docs", "exposure", "impact", "security", "support"]);
    expect(enqueue.mock.calls.map((c) => c[1])).toEqual(expect.arrayContaining([
      { orgId: "o1", agent: "impact", trigger: "event:change.confirmed", input: { reason: "change.confirmed", decisionId: "d-1", contractId: null } },
      { orgId: "o1", agent: "contract", trigger: "event:change.confirmed", input: { reason: "change.confirmed", decisionId: "d-1", contractId: null } },
      { orgId: "o1", agent: "exposure", trigger: "event:change.confirmed", input: { reason: "change.confirmed", decisionId: "d-1", contractId: null } },
      { orgId: "o1", agent: "access", trigger: "event:change.confirmed", input: { reason: "change.confirmed", decisionId: "d-1", contractId: null } },
    ]));
  });
  it("conflict.found queues the Decision Advisor with the decision id", async () => {
    const enqueue = vi.fn(async (_n: string, _d: object) => "job");
    expect(await dispatchAgents({ type: "conflict.found", orgId: "o1", payload: { changeId: "d-1", conflictsWith: "ctr-1" } }, enqueue)).toEqual(["advisor"]);
    expect(enqueue.mock.calls[0][1]).toEqual({ orgId: "o1", agent: "advisor", trigger: "event:conflict.found", input: { reason: "conflict.found", decisionId: "d-1", contractId: null } });
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

describe("digest tick: hourly, only people whose local time is their digest hour", () => {
  const at = (iso: string) => Math.floor(Date.parse(iso) / 1000);
  const base = (now: number, rows: { personId: string; tz?: string; digest?: boolean }[]) => ({
    orgs: async () => [{ id: "acme", isDemo: false, graphName: "g" }, { id: "demo", isDemo: true, graphName: "d" }],
    people: async () => [{ id: "p-priya", teamId: "eng" }, { id: "p-ana", teamId: "support" }, { id: "p-vera", teamId: "leadership" }],
    prefs: async () => ({ rows, org: null }),
    enqueue: vi.fn(async (_n: string, _d: object) => "job"), demoAgents: false, now,
  });
  it("Monday 08:30 in Kolkata: Priya (Kolkata) gets one digest job, Ana (New York, Sunday night) and Vera (UTC, 03:00) do not", async () => {
    const d = base(at("2026-10-12T03:00:00Z"), [{ personId: "p-priya", tz: "Asia/Calcutta" }, { personId: "p-ana", tz: "America/New_York" }]);
    expect(await digestFanOut(d)).toEqual(["acme:p-priya"]);
    expect(d.enqueue.mock.calls.map((c) => c[1])).toEqual([{ orgId: "acme", agent: "digest", trigger: "cron", input: { personId: "p-priya", teamId: "eng", weekStart: "2026-10-12" } }]);
  });
  it("a person with the digest off gets nothing, even in their hour", async () => {
    const d = base(at("2026-10-12T03:00:00Z"), [{ personId: "p-priya", tz: "Asia/Calcutta", digest: false }]);
    expect(await digestFanOut(d)).toEqual([]);
    expect(d.enqueue).not.toHaveBeenCalled();
  });
  it("any other hour or day queues nothing; the demo org is skipped", async () => {
    expect(await digestFanOut(base(at("2026-10-12T04:00:00Z"), [{ personId: "p-priya", tz: "Asia/Calcutta" }]))).toEqual([]);
    expect(await digestFanOut(base(at("2026-10-13T08:10:00Z"), []))).toEqual([]);
    const d = base(at("2026-10-12T08:10:00Z"), []); // 08:10 UTC Monday: everyone without a zone
    expect(await digestFanOut(d)).toEqual(["acme:p-priya", "acme:p-ana", "acme:p-vera"]);
    expect(await digestFanOut({ ...d, demoAgents: true })).toHaveLength(6);
  });
  it("the digest agent has an hourly cron and no event trigger", async () => {
    const { agent } = await import("../lib/agent/registry");
    expect(agent("digest")?.trigger).toEqual({ cron: "0 * * * *" });
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
