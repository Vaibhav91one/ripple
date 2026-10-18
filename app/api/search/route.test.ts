// GET /api/search against temp seeded graphs (never `demo`). Skips when FalkorDB is unreachable.
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { closeClient, graphFor, query, type Graph } from "@/lib/graph/client";
import { seed } from "@/lib/ingest/seed";
import type { SearchResult } from "@/lib/search";

import { GET } from "./route";

const a = `test_sa_${randomUUID().replaceAll("-", "")}`;
const b = `test_sb_${randomUUID().replaceAll("-", "")}`;
let ga: Graph, gb: Graph;
let up = false;

beforeAll(async () => {
  process.env.RIPPLE_GRAPH = a;
  process.env.RIPPLE_NOW = "2026-10-17T09:00:00Z";
  try {
    ga = await graphFor(a);
    await query(ga, "RETURN 1");
    up = true;
    await seed(a);
    gb = await graphFor(b);
    await query(gb, "CREATE (:System {id: 'sys-zebra', name: 'Zebracorn gateway'})");
  } catch (e) {
    console.warn(`SKIPPING search route tests: FalkorDB unreachable (${String(e)})`);
  }
}, 30_000);

afterAll(async () => {
  delete process.env.RIPPLE_VIEW_AS;
  process.env.RIPPLE_GRAPH = a;
  try {
    if (up) await Promise.all([ga.delete(), gb.delete().catch(() => {})]);
  } finally {
    await closeClient();
  }
});

const t = (title: string, fn: () => Promise<void>) =>
  it(title, async (ctx) => {
    if (!up) ctx.skip();
    await fn();
  });
const get = async (q: string, team = "eng"): Promise<{ status: number; body: any }> => { // eslint-disable-line @typescript-eslint/no-explicit-any
  process.env.RIPPLE_VIEW_AS = team;
  const res = await GET(new Request(`http://t/api/search?q=${encodeURIComponent(q)}`));
  return { status: res.status, body: (await res.json()) as SearchResult };
};

describe("GET /api/search", () => {
  t("\"v1\" finds the sunset change first, linked to its case file, and an agent search finds the registry", async () => {
    const { status, body } = await get("v1");
    expect(status).toBe(200);
    expect(body.hits.find((h: { id: string }) => h.id === "d-1")).toMatchObject({ group: "change", title: "Sunset API v1 on Jan 31", href: "/reports/d-1" });
    expect(body.hits.some((h: { group: string }) => h.group === "system")).toBe(true);
    expect((await get("impact")).body.hits.some((h: { group: string }) => h.group === "agent")).toBe(true);
  });

  t("\"northwind\" shows the customer, the v1 sunset change, and the MSA contract only as a stub to non-Legal viewers", async () => {
    const eng = (await get("northwind", "eng")).body;
    expect(eng.hits.some((h: { group: string; title: string }) => h.group === "customer" && /northwind/i.test(h.title))).toBe(true);
    expect(eng.hits.find((h: { id: string }) => h.id === "d-1")).toMatchObject({ group: "change", href: "/reports/d-1" });
    const stub = eng.hits.find((h: { group: string }) => h.group === "contract");
    expect(stub).toMatchObject({ restricted: true, title: "Contract (restricted)" });
    expect(stub.href).not.toMatch(/northwind/i);
    const legal = (await get("northwind", "legal")).body;
    expect(legal.hits.find((h: { group: string }) => h.group === "contract")).toMatchObject({ restricted: false });
    expect(legal.hits.find((h: { group: string }) => h.group === "contract").title).toMatch(/northwind/i);
  });

  t("searches only the viewer's graph (demo vs an org graph)", async () => {
    process.env.RIPPLE_GRAPH = a;
    expect((await get("zebracorn")).body.hits.filter((h: { group: string }) => h.group !== "agent")).toEqual([]);
    process.env.RIPPLE_GRAPH = b;
    expect((await get("zebracorn")).body.hits.map((h: { id: string }) => h.id)).toEqual(["sys-zebra"]);
    process.env.RIPPLE_GRAPH = a;
  });

  t("rejects an empty or huge query and survives full-text syntax", async () => {
    expect((await get("")).status).toBe(400);
    expect((await get("x".repeat(81))).status).toBe(400);
    expect((await get("\"(|)-@*")).status).toBe(200);
  });
});
