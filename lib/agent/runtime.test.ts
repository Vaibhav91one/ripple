import { randomUUID } from "node:crypto";
import { MockLanguageModelV4 } from "ai/test";
import { z } from "zod";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { closeClient, graphFor, query, type Graph } from "../graph/client";
import { seed } from "../ingest/seed";

vi.mock("server-only", () => ({}));
const enqueue = vi.hoisted(() => vi.fn(async (..._a: unknown[]) => "job"));
vi.mock("../queue", () => ({ enqueue }));
// Two test agents instead of the real registry: a narrow allowlist and a tiny token budget.
vi.mock("./registry", async () => {
  const { defineAgent } = await import("./define");
  const base = { displayName: "T", tagline: "t", group: "understand", team: "eng", model: "reasoning", writes: [] as never[], trigger: {}, input: z.object({}), output: z.object({ answer: z.string() }), system: () => "test" } as const;
  const list = [
    defineAgent({ ...base, name: "t-who", tools: ["who_knows"], budget: { maxSteps: 4, maxTokens: 10_000 } }),
    defineAgent({ ...base, name: "t-ids", tools: ["who_knows"], output: z.object({ answer: z.string(), teamId: z.string() }), budget: { maxSteps: 4, maxTokens: 10_000 } }),
    defineAgent({ ...base, name: "t-prop", tools: ["create_tasks"], writes: ["create_task"], output: z.object({ answer: z.string(), teamId: z.string() }), budget: { maxSteps: 4, maxTokens: 10_000 } }),
    defineAgent({ ...base, name: "t-tiny", tools: ["who_knows"], budget: { maxSteps: 4, maxTokens: 5 } }),
  ];
  return { agents: () => list, agent: (n: string) => list.find((a) => a.name === n) };
});

const dbUrl = process.env.DATABASE_URL;
const gname = `test_r_${randomUUID().replaceAll("-", "")}`;
const NOW = Math.floor(Date.parse("2026-10-17T09:00:00Z") / 1000);
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
    console.warn(`SKIPPING runtime tests: FalkorDB unreachable (${String(e)})`);
  }
}, 30_000);
afterAll(async () => {
  if (graphUp) await g.delete();
  await closeClient();
});

const mk = (total: number) => ({
  inputTokens: { total: total - 2, noCache: total - 2, cacheRead: undefined, cacheWrite: undefined },
  outputTokens: { total: 2, text: 2, reasoning: undefined },
});
const gen = (content: unknown[], unified: string, total: number) =>
  ({ content, finishReason: { unified, raw: undefined }, usage: mk(total), warnings: [] }) as never;
const call = (id: string, toolName: string, input: object) => ({ type: "tool-call", toolCallId: id, toolName, input: JSON.stringify(input) });
const text = (t: string) => ({ type: "text", text: t });

describe.skipIf(!dbUrl)("runBackground (Postgres + FalkorDB)", () => {
  const org = { id: `test-run-${randomUUID()}` };
  const viewer = { kind: "agent", id: "t" };
  const ctx = () => ({ g, now: NOW, org, viewer });

  const stepsOf = async (runId: string) => {
    const { db } = await import("../db");
    const { runSteps } = await import("../db/schema");
    const { eq, asc } = await import("drizzle-orm");
    return db().select().from(runSteps).where(eq(runSteps.runId, runId)).orderBy(asc(runSteps.n));
  };

  afterAll(async () => {
    const { db } = await import("../db");
    const { agentRuns } = await import("../db/schema");
    const { eq } = await import("drizzle-orm");
    await db().delete(agentRuns).where(eq(agentRuns.orgId, org.id)); // cascades run_step
  });

  it("logs every tool call with cypher, sources and tokens, and stores the output", async (c) => {
    if (!graphUp) c.skip();
    const { runBackground } = await import("./runtime");
    const model = new MockLanguageModelV4({
      doGenerate: [
        gen([call("c1", "who_knows", { systemId: "api-v1" })], "tool-calls", 10),
        gen([text(JSON.stringify({ answer: "Priya" }))], "stop", 20),
      ],
    });
    const r = await runBackground("t-who", {}, { ...ctx(), model, trigger: "test" });
    expect(r).toMatchObject({ status: "done", output: { answer: "Priya" }, tokens: 30 });

    const steps = await stepsOf(r.runId);
    const toolStep = steps.find((s) => s.kind === "tool")!;
    expect(toolStep).toMatchObject({ tool: "who_knows", args: { systemId: "api-v1" }, tokens: 10 });
    expect(toolStep.cypher.length).toBeGreaterThan(0);
    expect(toolStep.cypher[0]).toMatch(/^\/\/ /);
    expect(toolStep.sourceIds.length).toBeGreaterThan(0);
    expect(steps.find((s) => s.kind === "text")?.tokens).toBe(20);
  }, 30_000);

  it("wraps tool output as <data source=...> for the model", async (c) => {
    if (!graphUp) c.skip();
    const { runBackground } = await import("./runtime");
    const model = new MockLanguageModelV4({
      doGenerate: [
        gen([call("c1", "who_knows", { systemId: "api-v1" })], "tool-calls", 10),
        gen([text(JSON.stringify({ answer: "x" }))], "stop", 10),
      ],
    });
    await runBackground("t-who", {}, { ...ctx(), model });
    expect(JSON.stringify(model.doGenerateCalls[1].prompt)).toContain('<data source=\\"tool:who_knows\\">');
  }, 30_000);

  it("ends with status budget when tokens exceed the agent budget", async (c) => {
    if (!graphUp) c.skip();
    const { runBackground } = await import("./runtime");
    const model = new MockLanguageModelV4({
      doGenerate: [gen([call("c1", "who_knows", { systemId: "api-v1" })], "tool-calls", 50), gen([text("{}")], "stop", 50)],
    });
    const r = await runBackground("t-tiny", {}, { ...ctx(), model });
    expect(r.status).toBe("budget");
    const { db } = await import("../db");
    const { agentRuns } = await import("../db/schema");
    const { eq } = await import("drizzle-orm");
    const [row] = await db().select().from(agentRuns).where(eq(agentRuns.id, r.runId));
    expect(row).toMatchObject({ status: "budget", tokens: 50 });
    expect(row.endedAt).not.toBeNull();
  }, 30_000);

  it("a tool outside the agent allowlist cannot run", async (c) => {
    if (!graphUp) c.skip();
    const { runBackground } = await import("./runtime");
    const { TOOLS } = await import("./tools");
    const spy = vi.spyOn(TOOLS.create_tasks, "run");
    const model = new MockLanguageModelV4({
      doGenerate: [
        gen([call("c1", "create_tasks", { decisionId: "d-1" })], "tool-calls", 10),
        gen([text(JSON.stringify({ answer: "done" }))], "stop", 10),
      ],
    });
    // the model never even sees create_tasks
    const r = await runBackground("t-who", {}, { ...ctx(), model });
    expect(model.doGenerateCalls[0].tools?.map((t) => t.name)).toEqual(["who_knows"]);
    expect(spy).not.toHaveBeenCalled();
    expect((await stepsOf(r.runId)).every((s) => !s.cypher.length)).toBe(true);
    spy.mockRestore();
  }, 30_000);

  it("an output naming a teamId no tool returned ends as rejected, with the reason and no output", async (c) => {
    if (!graphUp) c.skip();
    const { runBackground } = await import("./runtime");
    const model = new MockLanguageModelV4({
      doGenerate: [gen([call("c1", "who_knows", { systemId: "api-v1" })], "tool-calls", 10), gen([text(JSON.stringify({ answer: "x", teamId: "finance" }))], "stop", 10)],
    });
    const r = await runBackground("t-ids", {}, { ...ctx(), model });
    expect(r).toMatchObject({ status: "rejected", error: expect.stringContaining("teamId=finance") });
    expect(r.output).toBeUndefined();
    expect((await stepsOf(r.runId)).some((s) => s.kind === "validation")).toBe(true);
  }, 30_000);

  describe("auto-approved proposals are held until the run is validated", () => {
    const executions = () => enqueue.mock.calls.filter((c) => c[0] === "execute-action");
    const actionsOf = async (runId: string) => {
      const { db } = await import("../db");
      const { pendingActions } = await import("../db/schema");
      const { eq } = await import("drizzle-orm");
      return db().select().from(pendingActions).where(eq(pendingActions.runId, runId));
    };
    const run = async (teamId: string) => {
      const { db } = await import("../db");
      const { orgPolicy } = await import("../db/schema");
      await db().insert(orgPolicy).values({ orgId: org.id, actionKind: "create_task", autoApprove: true }).onConflictDoNothing();
      const { runBackground } = await import("./runtime");
      const model = new MockLanguageModelV4({
        doGenerate: [gen([call("c1", "create_tasks", { decisionId: "d-1" })], "tool-calls", 10), gen([text(JSON.stringify({ answer: "x", teamId }))], "stop", 10)],
      });
      return runBackground("t-prop", {}, { ...ctx(), model });
    };

    it("a rejected run (invented teamId) never reaches execute-action; its auto-approved actions are rejected", async (c) => {
      if (!graphUp) c.skip();
      enqueue.mockClear();
      const r = await run("finance");
      expect(r.status).toBe("rejected");
      expect(executions()).toHaveLength(0);
      const acts = await actionsOf(r.runId);
      expect(acts.length).toBeGreaterThan(0);
      expect(acts.every((a) => a.status === "rejected" && a.error?.includes("teamId=finance"))).toBe(true);
    }, 30_000);

    it("a run that passes validation releases its held actions to execute-action", async (c) => {
      if (!graphUp) c.skip();
      enqueue.mockClear();
      const r = await run("devrel"); // devrel is in the create_tasks rows
      expect(r.status).toBe("done");
      const acts = await actionsOf(r.runId);
      expect(acts.length).toBeGreaterThan(0);
      expect(executions()).toHaveLength(acts.length);
      expect(acts.every((a) => a.status === "approved")).toBe(true);
    }, 30_000);
  });

  it("unknown agent throws before logging anything", async () => {
    const { runBackground } = await import("./runtime");
    await expect(runBackground("nope", {}, ctx())).rejects.toThrow(/unknown agent/);
  });
});
