// GET /api/graph against a temp seeded graph (never `demo`). Skips when FalkorDB is unreachable.
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { closeClient, graphFor, query, type Graph } from "@/lib/graph/client";
import { seed } from "@/lib/ingest/seed";
import { GraphView } from "@/lib/graph/view";
import { toFlow } from "@/components/graph/model";
import { GET } from "./route";

const name = `test_g_${randomUUID().replaceAll("-", "")}`;
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

describe("GET /api/graph", () => {
  t("returns a schema-valid view in four lanes with the conflict path", async () => {
    const res = await get("/api/graph?d=d-1");
    expect(res.status).toBe(200);
    const v = GraphView.parse(await res.json());
    expect([...new Set(v.nodes.map((n) => n.lane))].sort()).toEqual([0, 1, 2, 3]);
    expect(v.nodes.find((n) => n.id === "c-customers")?.count).toBe(40);
    expect(v.nodes.find((n) => n.id === "legal")?.status).toBe("conflict");
    expect(v.nodes.filter((n) => n.status === "gap").map((n) => n.id).sort()).toEqual(["devrel", "security"]);
    expect(v.edges.filter((e) => e.status === "conflict").length).toBeGreaterThan(0);
    expect(v.edges.some((e) => e.sources.length > 0)).toBe(true);
    expect(v.lens).toBeNull();
    expect(v.cypher.map((c) => c.name)).toContain("graph-view");
  });

  t("?team= adds the lens and ?kinds= drops clusters", async () => {
    const v = GraphView.parse(await (await get("/api/graph?d=d-1&team=legal&kinds=contracts,tickets")).json());
    expect(v.lens?.teamId).toBe("legal");
    expect(v.lens?.nodeIds).toContain("c-contracts");
    expect(v.lens?.nodeIds).toContain("d-1");
    expect(v.nodes.filter((n) => n.lane === 2).map((n) => n.id).sort()).toEqual(["c-contracts", "c-tickets"]);
  });

  t("toFlow expands a cluster into a sub-lane and the time cut hides newer edges", async () => {
    const v = GraphView.parse(await (await get("/api/graph?d=d-1")).json());
    const flat = toFlow(v, { expanded: [], q: "", at: null });
    const open = toFlow(v, { expanded: ["c-contracts"], q: "", at: null });
    expect(open.nodes.length).toBe(flat.nodes.length + 2);
    expect(new Set(open.nodes.map((n) => n.x)).size).toBe(5);
    expect(toFlow(v, { expanded: [], q: "legal", at: null }).nodes.filter((n) => n.hit).map((n) => n.id)).toContain("legal");
    const early = Math.min(...v.edges.map((e) => e.validFrom));
    const cut = toFlow(v, { expanded: [], q: "", at: early });
    expect(cut.edges.length).toBeLessThan(flat.edges.length);
    expect(cut.nodes.map((n) => n.id)).toContain("d-1");
  });

  t("400 for a bad kind, 404 for an unknown decision", async () => {
    expect((await get("/api/graph?d=d-1&kinds=nope")).status).toBe(400);
    expect((await get("/api/graph?d=nope")).status).toBe(404);
  });
});
