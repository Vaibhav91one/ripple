// Reads never write: every GET route and every MCP read tool must leave graph.query (the write path) untouched.
import { randomUUID } from "node:crypto";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import Graph from "falkordb/dist/src/graph";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { closeClient, graphFor, query, readOnly, ReadOnlyGraphError } from "./client";
import { seed } from "../ingest/seed";
import { createRippleServer } from "../mcp/server";
import { TeamId } from "../teams";

const name = `test_ro_${randomUUID().replaceAll("-", "")}`;
const NOW = Math.floor(Date.parse("2026-10-17T09:00:00Z") / 1000);
let g: Graph;
let up = false;

beforeAll(async () => {
  process.env.RIPPLE_GRAPH = name;
  process.env.RIPPLE_NOW = "2026-10-17T09:00:00Z";
  try {
    g = await graphFor(name);
    await query(g, "RETURN 1");
    up = true;
    await seed(name);
  } catch (e) {
    console.warn(`SKIPPING read-only tests: FalkorDB unreachable (${String(e)})`);
  }
}, 30_000);

afterAll(async () => {
  try {
    if (up) await g.delete();
  } finally {
    await closeClient();
  }
});

const t = (title: string, fn: () => Promise<void>) =>
  it(title, async (ctx) => {
    if (!up) ctx.skip();
    await fn();
  });

describe("read paths never write", () => {
  t("readOnly(g).query throws, roQuery still works", async () => {
    const ro = readOnly(g);
    await expect(query(ro, "RETURN 1")).rejects.toThrow(ReadOnlyGraphError);
    await expect(ro.roQuery("RETURN 1")).resolves.toBeTruthy();
  });

  t("every GET route is 200 and never calls query", async () => {
    const spy = vi.spyOn(Graph.prototype, "query");
    const urls: [string, string, unknown?][] = [
      ["ripple", "/api/ripple?d=d-1"], ["graph", "/api/graph?d=d-1"], ["inbox", "/api/inbox?p=p-priya"],
      ["overview", "/api/overview"], ["changes", "/api/changes?since=0"], ["decisions", "/api/decisions"],
      ["people", "/api/people"], ["names", "/api/names"], ["bottleneck", "/api/bottleneck"],
      ["who-knows", "/api/who-knows?system=api-v1"],
      ["source/[id]", "/api/source/art-rfc14", { params: Promise.resolve({ id: "art-rfc14" }) }],
      ...TeamId.options.map(
        (team) => ["teams/[team]", `/api/teams/${team}`, { params: Promise.resolve({ team }) }] as [string, string, unknown],
      ),
    ];
    for (const [route, url, ctx] of urls) {
      const mod = await import(`../../app/api/${route}/route`);
      const res = await (mod.GET as (r: Request, c?: unknown) => Promise<Response>)(new Request(`http://t${url}`), ctx);
      expect(res.status, url).toBe(200);
    }
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  t("every MCP read tool runs on a read-only graph", async () => {
    const [a, b] = InMemoryTransport.createLinkedPair();
    await createRippleServer({ g: readOnly(g), now: NOW, demo: true }).connect(a);
    const client = new Client({ name: "test", version: "0" });
    await client.connect(b);
    const { tools } = await client.listTools();
    const args: Record<string, Record<string, unknown>> = {
      list_decisions: {}, search: { text: "api v1" }, who_knows: { systemId: "api-v1" }, bottleneck: {},
      why_affected: { decisionId: "d-1", teamId: "legal" },
    };
    const reads = tools.filter((x) => x.annotations?.readOnlyHint);
    expect(reads.length).toBeGreaterThanOrEqual(11);
    for (const x of reads) {
      const r = await client.callTool({ name: x.name, arguments: args[x.name] ?? { decisionId: "d-1" } });
      expect(r.isError, `${x.name}: ${JSON.stringify(r.content)}`).toBeFalsy();
    }
  });
});
