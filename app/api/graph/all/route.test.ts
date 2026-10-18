// GET /api/graph/all against a temp seeded graph (never `demo`). Skips when FalkorDB is unreachable.
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { closeClient, graphFor, query, type Graph } from "@/lib/graph/client";
import { seed } from "@/lib/ingest/seed";
import { GraphView } from "@/lib/graph/view";
import { ALL_CAP } from "@/lib/graph/graph-view";

import { GET } from "./route";

const name = `test_ga_${randomUUID().replaceAll("-", "")}`;
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
    console.warn(`SKIPPING graph route tests: FalkorDB unreachable (${String(e)})`);
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
const get = (url: string) => GET(new Request(`http://t${url}`));

describe("GET /api/graph/all", () => {
  t("returns the whole graph as a schema-valid view, capped, with no dangling edges", async () => {
    const res = await get("/api/graph/all");
    expect(res.status).toBe(200);
    const v = GraphView.parse(await res.json());
    const kinds = new Set(v.nodes.map((n) => n.kind));
    for (const k of ["decision", "system", "customers", "tickets", "deals", "contracts", "team"]) expect(kinds.has(k as never), k).toBe(true);
    expect(v.nodes.length).toBeLessThanOrEqual(ALL_CAP);
    const ids = new Set(v.nodes.map((n) => n.id));
    expect(v.edges.every((e) => ids.has(e.from) && ids.has(e.to))).toBe(true);
    expect(v.edges.length).toBeGreaterThan(v.nodes.length / 2);
    expect(v.nodes.every((n) => n.title.length > 0)).toBe(true);
    expect(v.nodes.some((n) => n.status === "conflict")).toBe(true);
    expect(v.cypher.map((c) => c.name)).toEqual(["graph-all", "graph-all-edges"]);
  });

  t("?kind= keeps only those evidence kinds and ?team= keeps the team's neighbourhood", async () => {
    const all = GraphView.parse(await (await get("/api/graph/all")).json());
    const k = GraphView.parse(await (await get("/api/graph/all?kind=contracts")).json());
    expect(k.nodes.some((n) => n.kind === "customers" || n.kind === "tickets" || n.kind === "deals")).toBe(false);
    expect(k.nodes.some((n) => n.kind === "contracts")).toBe(true);
    const legal = GraphView.parse(await (await get("/api/graph/all?team=legal")).json());
    expect(legal.nodes.map((n) => n.id)).toContain("legal");
    expect(legal.nodes.length).toBeLessThan(all.nodes.length);
  });

  t("400 for a bad kind", async () => {
    expect((await get("/api/graph/all?kind=nope")).status).toBe(400);
  });
});
