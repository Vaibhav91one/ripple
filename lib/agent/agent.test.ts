import { randomUUID } from "node:crypto";
import { simulateReadableStream } from "ai";
import { MockLanguageModelV4 } from "ai/test";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { closeClient, graphFor, query, type Graph } from "../graph/client";
import { seed } from "../ingest/seed";
import { StreamEvent } from "../schemas";
import { runAgent } from "./loop";
import { TOOLS } from "./tools";

const name = `test_a_${randomUUID().replaceAll("-", "")}`;
const NOW = Math.floor(Date.parse("2026-10-17T09:00:00Z") / 1000);
let g: Graph;
let up = false;

beforeAll(async () => {
  try {
    g = await graphFor(name);
    await query(g, "RETURN 1");
    up = true;
    await seed(name);
  } catch (e) {
    console.warn(`SKIPPING agent tests: FalkorDB unreachable (${String(e)})`);
  }
}, 30_000);

afterAll(async () => {
  try {
    if (up) await g.delete();
  } finally {
    await closeClient();
  }
});

const usage = {
  inputTokens: { total: 3, noCache: 3, cacheRead: undefined, cacheWrite: undefined },
  outputTokens: { total: 5, text: 5, reasoning: undefined },
};
const step = (chunks: unknown[]) => ({ stream: simulateReadableStream({ chunks: chunks as never[] }) });
const text = (t: string) => [
  { type: "text-start", id: "t" },
  { type: "text-delta", id: "t", delta: t },
  { type: "text-end", id: "t" },
];
const finish = (unified: string) => ({ type: "finish", finishReason: { unified, raw: undefined }, usage });

const t = (title: string, fn: () => Promise<void>) =>
  it(title, async (ctx) => {
    if (!up) ctx.skip();
    await fn();
  });

describe("agent loop with a scripted model", () => {
  t("who_knows -> answer; real ids cited, invented id dropped", async () => {
    const model = new MockLanguageModelV4({
      doStream: [
        step([
          { type: "tool-call", toolCallId: "c1", toolName: "who_knows", input: JSON.stringify({ systemId: "api-v1" }) },
          finish("tool-calls"),
        ]),
        step([
          ...text("Priya wrote the v1 handlers [[pr-v1-1]]. Also Zed [[art-invented]]."),
          finish("stop"),
        ]),
      ],
    });
    let tokens = 0;
    const events = [];
    for await (const e of runAgent({ model, question: "Who knows API v1?", g, now: NOW, onUsage: (n) => (tokens += n) }))
      events.push(StreamEvent.parse(e));

    const types = events.map((e) => e.type);
    expect(types.slice(0, 2)).toEqual(["tool_call", "tool_result"]);
    expect(types.at(-1)).toBe("done");
    expect(types.indexOf("text_delta")).toBeGreaterThan(1);
    expect(types.indexOf("citation")).toBeGreaterThan(types.indexOf("text_delta"));

    const call = events[0];
    expect(call).toMatchObject({ tool: "who_knows", args: { systemId: "api-v1" } });
    expect(call.type === "tool_call" && call.cypher).toContain("MATCH");
    const result = events[1];
    expect(result.type === "tool_result" && result.sourceIds).toContain("pr-v1-1");

    const cites = events.flatMap((e) => (e.type === "citation" ? e.sources.map((s) => s.artifactId) : []));
    expect(cites).toEqual(["pr-v1-1"]);
    expect(JSON.stringify(events)).not.toContain("art-invented");
    expect(tokens).toBeGreaterThan(0);
  });
});

describe("tools on a seeded temp graph", () => {
  const ctx = () => ({ g, now: NOW, demo: true });

  t("who_knows returns rows, source ids and the cypher it ran", async () => {
    const o = await TOOLS.who_knows.run(ctx(), { systemId: "api-v1" });
    expect(o.rows[0]).toMatchObject({ personId: "p-priya" });
    expect(o.sources.map((s) => s.artifactId)).toContain("pr-v1-1");
    expect(o.cypher.map((c) => c.name)).toContain("who-knows");
  });

  t("ripple reports the gap teams", async () => {
    const o = await TOOLS.ripple.run(ctx(), { decisionId: "d-1" });
    expect((o.rows[0].gap as string[]).sort()).toEqual(["devrel", "legal", "security"]);
    expect(o.sources.length).toBeGreaterThan(0);
  });

  t("search, trace_decision and bottleneck run", async () => {
    expect((await TOOLS.search.run(ctx(), { text: "auth" })).rows.length).toBeGreaterThan(0);
    const tr = await TOOLS.trace_decision.run(ctx(), { decisionId: "d-1" });
    expect(tr.rows[0]).toMatchObject({ id: "d-1" });
    expect((await TOOLS.bottleneck.run(ctx(), {})).rows.length).toBeGreaterThan(0);
  });

  t("tools answer honestly when the graph has nothing", async () => {
    const nf = (o: { rows: Record<string, unknown>[] }) => o.rows[0];
    expect(nf(await TOOLS.who_knows.run(ctx(), { systemId: "fax-gateway" }))).toMatchObject({ found: false, note: expect.stringContaining("fax-gateway"), knownSystems: expect.arrayContaining([expect.objectContaining({ id: "auth-service" })]) });
    expect(nf(await TOOLS.ripple.run(ctx(), { decisionId: "d-nope" }))).toMatchObject({ found: false, knownDecisions: expect.arrayContaining([expect.objectContaining({ id: "d-1" })]) });
    expect(nf(await TOOLS.why_affected.run(ctx(), { decisionId: "v1-sunset", teamId: "data" }))).toMatchObject({ found: false, knownDecisions: expect.arrayContaining([expect.objectContaining({ id: "d-1" })]) });
    expect(nf(await TOOLS.trace_decision.run(ctx(), { decisionId: "d-nope" }))).toMatchObject({ found: false });
    expect(nf(await TOOLS.search.run(ctx(), { text: "zzqxnonexistentword" }))).toMatchObject({ found: false });
  });

  t("ripple tool depth 4 reaches the data team", async () => {
    const o = await TOOLS.ripple.run(ctx(), { decisionId: "d-1", depth: 4 });
    expect(o.rows[0].gap as string[]).toContain("data");
  });

  t("create_tasks writes a Task + NOTIFIES per gap team, demo only", async () => {
    await expect(TOOLS.create_tasks.run({ ...ctx(), demo: false }, { decisionId: "d-1" })).rejects.toThrow(/demo/);
    const o = await TOOLS.create_tasks.run(ctx(), { decisionId: "d-1" });
    expect(o.rows.map((r) => r.teamId).sort()).toEqual(["devrel", "legal", "security"]);
    const n = await query<{ n: number }>(g, "MATCH (:Task)-[:NOTIFIES]->(t:Team) WHERE t.id IN ['legal','security','devrel'] RETURN count(t) AS n");
    expect(Number(n[0].n)).toBe(3);
  });
});
