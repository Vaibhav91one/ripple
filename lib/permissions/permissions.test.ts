// The sentinel-leak test: restricted payload must never reach a viewer who does not own it, on EVERY GET route,
// EVERY agent tool and EVERY MCP tool. Sentinels are seeded into restricted fields of a temp graph.
// A new route or tool that is not listed below fails the coverage checks on purpose: add it here.
import { randomUUID } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { simulateReadableStream } from "ai";
import { MockLanguageModelV4 } from "ai/test";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { TOOLS } from "../agent/tools";
import { runAgent } from "../agent/loop";
import { closeClient, graphFor, query, type Graph } from "../graph/client";
import { seed } from "../ingest/seed";
import { createRippleServer } from "../mcp/server";
import { RippleResult } from "../schemas";
import { restrictedLine } from "./classify";

vi.mock("next/server", async (orig) => ({ ...(await orig<typeof import("next/server")>()), connection: async () => {} })); // health route, outside a request

const name = `test_p_${randomUUID().replaceAll("-", "")}`;
const NOW = Math.floor(Date.parse("2026-10-17T09:00:00Z") / 1000);
let g: Graph;
let up = false;

/** owner team -> strings that must not reach anyone else. */
const SENTINELS = {
  legal: ["SENTINEL_CONTRACT", "SENTINEL_CLAUSE", "7770001"],
  sales: ["SENTINEL_DEAL", "7770002", "7770003"], // 7770003 = customer ARR
  security: ["SENTINEL_FINDING", "SENTINEL_CONTROL"],
} as const;
const SRC = ["SENTINEL_SRC"]; // quote + artifact text behind restricted payload: hidden from viewers who own none of it
const OWNERS = Object.keys(SENTINELS) as (keyof typeof SENTINELS)[];
/** viewers: the demo lenses */
// "change-owner" = the demo lens: team eng plus the change_owner role (summaries, no details)
const VIEWERS = ["eng", "change-owner", "legal", "sales", "security", "leadership", "support", "devrel"] as const;
type V = (typeof VIEWERS)[number];
/** the viewer as the permission layer sees it */
const pv = (v: V) => (v === "change-owner" ? { teamIds: ["eng"], role: "change_owner" } : { teamIds: [v] });
const forbidden = (v: V) => [
  ...OWNERS.filter((o) => !pv(v).teamIds.includes(o)).flatMap((o) => SENTINELS[o]),
  ...(OWNERS.some((o) => pv(v).teamIds.includes(o)) ? [] : SRC),
];
const snip = (t: string, s: string) => t.slice(Math.max(0, t.indexOf(s) - 150), t.indexOf(s) + 60);
const as = (v: V) => {
  process.env.RIPPLE_VIEW_AS = pv(v).teamIds.join(",");
  process.env.RIPPLE_VIEW_ROLE = pv(v).role ?? "";
};

beforeAll(async () => {
  process.env.RIPPLE_GRAPH = name;
  process.env.RIPPLE_NOW = "2026-10-17T09:00:00Z";
  try {
    g = await graphFor(name);
    await query(g, "RETURN 1");
    up = true;
    await seed(name);
    for (const q of [
      "MATCH (c:Contract) SET c.name = c.name + ' SENTINEL_CONTRACT', c.value = 7770001",
      "MATCH (k:Clause) SET k.title = k.title + ' SENTINEL_CLAUSE', k.text = k.text + ' SENTINEL_CLAUSE'",
      "MATCH (d:Deal) SET d.name = d.name + ' SENTINEL_DEAL', d.amount = 7770002",
      "MATCH (f:Finding) SET f.title = f.title + ' SENTINEL_FINDING'",
      "MATCH (c:Control) SET c.name = c.name + ' SENTINEL_CONTROL'",
      "MATCH (cu:Customer) SET cu.arr = 7770003",
      "MATCH ()-[r:GUARANTEES|PROMISED|HAS_CLAUSE]->() SET r.quote = 'SENTINEL_SRC ' + coalesce(r.quote, '')",
      "MATCH ()-[r:GUARANTEES|PROMISED|HAS_CLAUSE]->() WITH collect(DISTINCT r.src) AS ids MATCH (a:Artifact) WHERE a.id IN ids SET a.text = 'SENTINEL_SRC ' + a.text, a.title = a.title + ' SENTINEL_SRC'",
    ]) await query(g, q);
  } catch (e) {
    console.warn(`SKIPPING permission tests: FalkorDB unreachable (${String(e)})`);
  }
}, 60_000);

afterAll(async () => {
  delete process.env.RIPPLE_VIEW_AS;
  delete process.env.RIPPLE_VIEW_ROLE;
  try {
    if (up) await g.delete();
  } finally {
    await closeClient();
  }
});

const t = (title: string, fn: () => Promise<void>, timeout?: number) =>
  it(title, async (ctx) => {
    if (!up) ctx.skip();
    await fn();
  }, timeout);

// ---------- routes ----------
const TEAMS = ["eng", "support", "sales", "legal", "security", "devrel", "leadership"];
/** every GET route -> the URLs (and dynamic params) that exercise it */
const ROUTES: Record<string, { url: string; params?: Record<string, string> }[]> = {
  "bottleneck": [{ url: "/api/bottleneck" }],
  "people": [{ url: "/api/people" }],
  "overview": [{ url: "/api/overview" }],
  "names": [{ url: "/api/names" }],
  "decisions": [{ url: "/api/decisions" }],
  "changes": [{ url: "/api/changes?since=0" }],
  "ripple": [{ url: "/api/ripple?d=d-1" }, { url: "/api/ripple?d=d-1&depth=4" }],
  "graph": [{ url: "/api/graph?d=d-1" }, { url: "/api/graph?d=d-1&team=legal" }],
  "inbox": [{ url: "/api/inbox?p=p-ana" }],
  "who-knows": [{ url: "/api/who-knows?system=api-v1" }],
  "health": [{ url: "/api/health" }],
  "items/[kind]/[id]": [{ url: "/api/items/x/y" }],
  "search": [{ url: "/api/search?q=SENTINEL_SRC" }],
  "mcp": [{ url: "/api/mcp" }],
  "teams/[team]": TEAMS.map((x) => ({ url: `/api/teams/${x}`, params: { team: x } })),
  "source/[id]": [] , // filled in beforeAll from the graph: every artifact
};

function routeFiles(dir: string, out: string[] = []): string[] {
  for (const f of readdirSync(dir)) {
    const p = path.join(dir, f);
    if (statSync(p).isDirectory()) routeFiles(p, out);
    else if (f === "route.ts" && /export (async )?function GET|export const GET/.test(readFileSync(p, "utf8"))) out.push(path.relative("app/api", path.dirname(p)));
  }
  return out;
}

const get = async (route: string, url: string, params?: Record<string, string>) => {
  const mod = await import(`../../app/api/${route}/route`);
  const res = await (mod.GET as (r: Request, c?: unknown) => Promise<Response>)(new Request(`http://t${url}`), { params: Promise.resolve(params ?? {}) });
  return { status: res.status, text: await res.text() };
};

describe("every GET route is covered", () => {
  it("lists a URL for each app/api GET route", () => {
    const files = routeFiles("app/api").sort();
    expect(Object.keys(ROUTES).sort()).toEqual(files);
  });
});

describe("sentinel leak: GET routes", () => {
  t("no route leaks a sentinel to a non-owner", async () => {
    const arts = await query<{ id: string }>(g, "MATCH (a:Artifact) RETURN a.id AS id");
    ROUTES["source/[id]"] = arts.map((a) => ({ url: `/api/source/${a.id}`, params: { id: a.id } }));
    let checked = 0;
    for (const v of VIEWERS) {
      as(v);
      for (const [route, cases] of Object.entries(ROUTES))
        for (const c of cases) {
          const r = await get(route, c.url, c.params);
          for (const s of forbidden(v)) expect(r.text, `${v} ${c.url} leaked ${s}: ${snip(r.text, s)}`).not.toContain(s);
          checked++;
        }
    }
    expect(checked).toBeGreaterThan(VIEWERS.length * 30);
  }, 120_000);

  t("owners see their own payload (the test is not vacuous)", async () => {
    as("legal");
    expect((await get("teams/[team]", "/api/teams/legal", { team: "legal" })).text).toContain("SENTINEL_CONTRACT");
    as("sales");
    expect((await get("teams/[team]", "/api/teams/sales", { team: "sales" })).text).toContain("SENTINEL_DEAL");
    expect((await get("teams/[team]", "/api/teams/support", { team: "support" })).text).toContain("7770003");
    as("security");
    expect((await get("teams/[team]", "/api/teams/security", { team: "security" })).text).toContain("SENTINEL_FINDING");
    as("legal");
    expect((await get("graph", "/api/graph?d=d-1")).text).toContain("SENTINEL_SRC"); // legal's quotes
  });

  t("topology is identical for every viewer; only payload differs", async () => {
    const topo: unknown[] = [];
    for (const v of VIEWERS) {
      as(v);
      const r = RippleResult.parse(JSON.parse((await get("ripple", "/api/ripple?d=d-1")).text));
      const { arrAtRisk, ...counts } = r.counts;
      void arrAtRisk;
      topo.push({
        teams: r.teams.map((x) => [x.teamId, x.involved, x.acked]), gap: [...r.gap].sort(), counts,
        nodes: r.nodes.map((n) => [n.id, n.kind, n.hop]), edges: r.edges, conflicts: r.conflicts.map((c) => [c.id, c.contractIds]),
      });
    }
    for (const x of topo) expect(x).toEqual(topo[0]);
  });

  t("Sales sees 'restricted to Legal', Legal sees the clauses, leadership sees totals without text", async () => {
    as("sales");
    const s = JSON.parse((await get("ripple", "/api/ripple?d=d-1")).text);
    expect(s.restricted).toContainEqual(expect.objectContaining({ kind: "contract", owner: "legal", count: 2 }));
    expect(restrictedLine({ kind: "contract", owner: "legal", count: 2 })).toBe("2 contracts — restricted to Legal");
    expect(s.counts.arrAtRisk).not.toBeNull();
    as("legal");
    const l = JSON.parse((await get("ripple", "/api/ripple?d=d-1")).text);
    expect(l.restricted?.some((r: { owner: string }) => r.owner === "legal")).toBeFalsy();
    expect(l.counts.arrAtRisk).toBeNull(); // customer ARR is Sales'
    expect((await get("teams/[team]", "/api/teams/legal", { team: "legal" })).text).toContain("SENTINEL_CLAUSE");
    as("leadership");
    const d = JSON.parse((await get("teams/[team]", "/api/teams/legal", { team: "legal" })).text);
    expect(d.clauses).toEqual([]);
    expect(d.kpis.length).toBeGreaterThan(0);
    expect(d.restricted).toContainEqual(expect.objectContaining({ kind: "contract", owner: "legal", total: expect.any(Number) }));
  });
});

describe("change owners (and leadership) get summaries, never details", () => {
  t("the change owner sees ARR at risk, KPIs and totals but no sentinel", async () => {
    as("change-owner");
    const r = JSON.parse((await get("ripple", "/api/ripple?d=d-1")).text);
    expect(r.counts.arrAtRisk).toBe(2 * 7770003); // the number is visible, customer-level ARR is not
    const o = JSON.parse((await get("overview", "/api/overview")).text);
    expect(o.kpis.map((k: { id: string }) => k.id)).toContain("arr-at-risk");
    const d = JSON.parse((await get("teams/[team]", "/api/teams/sales", { team: "sales" })).text);
    expect(d.deals).toEqual([]);
    expect(d.kpis.length).toBeGreaterThan(0);
    const deals = d.restricted.find((x: { kind: string }) => x.kind === "deal");
    expect(deals.count).toBeGreaterThanOrEqual(3);
    expect(deals.total).toBe(deals.count * 7770002); // a total, not the rows
    const c = JSON.parse((await get("teams/[team]", "/api/teams/support", { team: "support" })).text);
    expect(c.customers.every((x: { arr: unknown }) => x.arr === null)).toBe(true);
    as("eng"); // a plain member of Eng has neither
    expect(JSON.parse((await get("ripple", "/api/ripple?d=d-1")).text).counts.arrAtRisk).toBeNull();
    expect(JSON.parse((await get("overview", "/api/overview")).text).kpis.map((k: { id: string }) => k.id)).not.toContain("arr-at-risk");
  });

  t("deals at risk reach the change owner over MCP as a count plus a total", async () => {
    const [a, b] = InMemoryTransport.createLinkedPair();
    await createRippleServer({ g, now: NOW, demo: true, viewer: pv("change-owner") }).connect(a);
    const client = new Client({ name: "test", version: "0" });
    await client.connect(b);
    const out = JSON.parse(((await client.callTool({ name: "deals_at_risk", arguments: { decisionId: "d-1" } })).content as { text: string }[])[0].text);
    expect(out.rows).toEqual([]);
    expect(out.restricted).toContainEqual(expect.objectContaining({ kind: "deal", owner: "sales", count: 3, total: 3 * 7770002 }));
    await client.close();
  });
});

// ---------- agent tools ----------
const ARGS: Record<string, Record<string, unknown>> = {
  search: { text: "v1 sunset" },
  ripple: { decisionId: "d-1", depth: 4 },
  who_knows: { systemId: "api-v1" },
  trace_decision: { decisionId: "d-1" },
  bottleneck: {},
  why_affected: { decisionId: "d-1", teamId: "legal" },
  create_tasks: { decisionId: "d-1" },
};
const usage = {
  inputTokens: { total: 3, noCache: 3, cacheRead: undefined, cacheWrite: undefined },
  outputTokens: { total: 5, text: 5, reasoning: undefined },
};
const step = (chunks: unknown[]) => ({ stream: simulateReadableStream({ chunks: chunks as never[] }) });

describe("sentinel leak: agent tools", () => {
  it("every agent tool has args here", () => {
    expect(Object.keys(ARGS).sort()).toEqual(Object.keys(TOOLS).sort());
  });

  t("tool results (what the model and the stream see) hold no foreign sentinel", async () => {
    const calls = [
      ...Object.entries(ARGS).filter(([n]) => n !== "create_tasks").map(([n, a]) => [n, a] as const),
      ["why_affected", { decisionId: "d-1", teamId: "sales" }] as const,
      ["why_affected", { decisionId: "d-1", teamId: "security" }] as const,
      ["ripple", { decisionId: "d-1" }] as const,
    ];
    for (const v of VIEWERS) {
      const model = new MockLanguageModelV4({
        doStream: [
          step([
            ...calls.map(([toolName, input], i) => ({ type: "tool-call", toolCallId: `c${i}`, toolName, input: JSON.stringify(input) })),
            { type: "finish", finishReason: { unified: "tool-calls", raw: undefined }, usage },
          ]),
          step([{ type: "text-start", id: "t" }, { type: "text-delta", id: "t", delta: "ok" }, { type: "text-end", id: "t" }, { type: "finish", finishReason: { unified: "stop", raw: undefined }, usage }]),
        ],
      });
      const events = [];
      for await (const e of runAgent({ model, question: "q", g, now: NOW, viewer: pv(v) })) events.push(e);
      const results = events.filter((e) => e.type === "tool_result");
      expect(results.length).toBe(calls.length);
      const text = JSON.stringify(events);
      for (const s of forbidden(v)) expect(text, `${v} agent leaked ${s}: ${snip(text, s)}`).not.toContain(s);
    }
  }, 60_000);

  t("create_tasks output is redacted too", async () => {
    const { redactToolOut } = await import("./redact");
    const out = await TOOLS.create_tasks.run({ g, now: NOW, demo: true }, { decisionId: "d-1" });
    for (const v of VIEWERS) {
      const text = JSON.stringify(await redactToolOut(g, pv(v), out));
      for (const s of forbidden(v)) expect(text, `${v} create_tasks leaked ${s}`).not.toContain(s);
    }
  });

  t("a viewer with no team sees no payload (fails closed)", async () => {
    const { redactToolOut } = await import("./redact");
    const out = await redactToolOut(g, undefined, await TOOLS.ripple.run({ g, now: NOW, demo: true }, { decisionId: "d-1" }));
    expect(JSON.stringify(out)).not.toContain("SENTINEL");
    expect(out.restricted?.length).toBeGreaterThan(0);
  });
});

// ---------- MCP ----------
const MCP_ARGS: Record<string, Record<string, unknown>> = {
  list_decisions: {},
  search: { text: "v1 sunset" },
  ripple_impact: { decisionId: "d-1", depth: 4 },
  who_knows: { systemId: "api-v1" },
  trace_decision: { decisionId: "d-1" },
  bottleneck: {},
  why_affected: { decisionId: "d-1", teamId: "legal" },
  who_wasnt_told: { decisionId: "d-1" },
  check_contract_conflict: { decisionId: "d-1" },
  deals_at_risk: { decisionId: "d-1" },
  affected_controls: { decisionId: "d-1" },
  ack_brief: { decisionId: "d-1", teamId: "legal", kind: "seen" },
};

describe("sentinel leak: MCP tools", () => {
  t("every MCP tool is listed here and leaks nothing", async () => {
    for (const v of VIEWERS) {
      const [a, b] = InMemoryTransport.createLinkedPair();
      await createRippleServer({ g, now: NOW, demo: true, viewer: pv(v) }).connect(a);
      const client = new Client({ name: "test", version: "0" });
      await client.connect(b);
      const { tools } = await client.listTools();
      expect(tools.map((x) => x.name).sort()).toEqual(Object.keys(MCP_ARGS).sort());
      for (const tool of tools) {
        const r = await client.callTool({ name: tool.name, arguments: MCP_ARGS[tool.name] });
        const text = JSON.stringify(r);
        for (const s of forbidden(v)) expect(text, `${v} mcp ${tool.name} leaked ${s}: ${snip(text, s)}`).not.toContain(s);
      }
      await client.close();
    }
  }, 120_000);

  t("owners see their own payload over MCP", async () => {
    const [a, b] = InMemoryTransport.createLinkedPair();
    await createRippleServer({ g, now: NOW, demo: true, viewer: { teamIds: ["sales"] } }).connect(a);
    const client = new Client({ name: "test", version: "0" });
    await client.connect(b);
    const r = JSON.stringify(await client.callTool({ name: "deals_at_risk", arguments: { decisionId: "d-1" } }));
    expect(r).toContain("SENTINEL_DEAL");
    await client.close();
  });
});

// ---------- background runtime (#140) ----------
describe("sentinel leak: runBackground tool outputs", () => {
  t("the redactToolOutput hook leaves no foreign sentinel for any tool", async () => {
    const { redactToolOutput } = await import("../agent/runtime");
    for (const v of VIEWERS)
      for (const [tool, args] of Object.entries(ARGS)) {
        if (tool === "create_tasks") continue;
        const out = await redactToolOutput(await TOOLS[tool as keyof typeof TOOLS].run({ g, now: NOW, demo: true, viewer: pv(v) }, args as never), { kind: "agent", ...pv(v) }, g);
        const text = JSON.stringify(out);
        for (const x of forbidden(v)) expect(text, `${v} background ${tool} leaked ${x}: ${snip(text, x)}`).not.toContain(x);
      }
  }, 60_000);
});

// the same through runBackground itself: what the model is prompted with (needs Postgres, like lib/agent/runtime.test.ts)
vi.mock("server-only", () => ({}));
vi.mock("../agent/registry", async () => {
  const { z } = await import("zod");
  const { defineAgent } = await import("../agent/define");
  const a = defineAgent({
    name: "t-all", group: "understand", team: "eng", model: "reasoning", writes: [], trigger: {}, input: z.object({}), output: z.object({ answer: z.string() }),
    system: () => "test", tools: ["search", "ripple", "who_knows", "trace_decision", "bottleneck", "why_affected"], budget: { maxSteps: 4, maxTokens: 100_000 },
  });
  return { agents: () => [a], agent: (n: string) => (n === a.name ? a : undefined) };
});
describe.skipIf(!process.env.DATABASE_URL)("sentinel leak: runBackground prompts (Postgres)", () => {
  t("the model is never prompted with a foreign sentinel", async () => {
    const { runBackground } = await import("../agent/runtime");
    const usage2 = (n: number) => ({ inputTokens: { total: n, noCache: n, cacheRead: undefined, cacheWrite: undefined }, outputTokens: { total: 2, text: 2, reasoning: undefined } });
    const gen = (content: unknown[], unified: string) => ({ content, finishReason: { unified, raw: undefined }, usage: usage2(5), warnings: [] }) as never;
    const calls = [
      ["search", { text: "v1 sunset" }], ["ripple", { decisionId: "d-1", depth: 4 }], ["who_knows", { systemId: "api-v1" }],
      ["trace_decision", { decisionId: "d-1" }], ["bottleneck", {}], ["why_affected", { decisionId: "d-1", teamId: "legal" }],
    ] as const;
    for (const v of VIEWERS) {
      const model = new MockLanguageModelV4({
        doGenerate: [
          gen(calls.map(([toolName, input], i) => ({ type: "tool-call", toolCallId: `c${i}`, toolName, input: JSON.stringify(input) })), "tool-calls"),
          gen([{ type: "text", text: JSON.stringify({ answer: "ok" }) }], "stop"),
        ],
      });
      const r = await runBackground("t-all", {}, { g, now: NOW, org: { id: `perm-${randomUUID()}` }, viewer: { kind: "agent", ...pv(v) }, model });
      expect(r.status).toBe("done");
      const prompt = JSON.stringify(model.doGenerateCalls[1].prompt);
      for (const x of forbidden(v)) expect(prompt, `${v} runBackground prompt leaked ${x}`).not.toContain(x);
    }
  }, 120_000);
});
