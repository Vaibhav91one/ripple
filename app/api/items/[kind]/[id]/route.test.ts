// GET /api/items/[kind]/[id] against a temp seeded graph (never `demo`). Skips when FalkorDB is unreachable.
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { closeClient, graphFor, query, type Graph } from "@/lib/graph/client";
import { seed } from "@/lib/ingest/seed";
import { ITEM_KINDS } from "@/lib/items/kinds";
import { ItemView } from "@/lib/schemas";
import { GET } from "./route";

const name = `test_i_${randomUUID().replaceAll("-", "")}`;
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
    console.warn(`SKIPPING item route tests: FalkorDB unreachable (${String(e)})`);
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
const get = (kind: string, id: string) => GET(new Request(`http://t/api/items/${kind}/${id}`), { params: Promise.resolve({ kind, id }) });

/** a seeded id per kind and the title its adapter must produce */
/** seeded docs and messages are only cited as sources, never linked by an edge */
const ISOLATED = new Set(["doc", "message"]);
const SEEDED: Record<string, [id: string, title?: RegExp]> = {
  pr: ["art-pr-auth"], ticket: ["art-tkt-1"], doc: ["art-rfc14", /RFC/i], message: ["art-msg-lost"], contract: ["ctr-1"], clause: ["clause-g1"],
  customer: ["cust-1"], deal: ["deal-1"], system: ["api-v1"], person: ["p-priya", /Priya/], team: ["eng"], control: ["ctl-1"],
  finding: ["finding-1"], task: ["task-1"], change: ["d-1"],
};

describe("GET /api/items/[kind]/[id]", () => {
  for (const [kind, [id, title]] of Object.entries(SEEDED))
    t(`${kind}: ${id} is a schema-valid ItemView`, async () => {
      const res = await get(kind, id);
      expect(res.status, await res.clone().text()).toBe(200);
      const v = ItemView.parse(await res.json());
      expect(v).toMatchObject({ kind, id, icon: ITEM_KINDS[kind].icon });
      expect(v.label.toLowerCase()).toBe(ITEM_KINDS[kind].label.toLowerCase()); // redaction lower-cases a restricted node label
      expect(v.title.length).toBeGreaterThan(0);
      if (title) expect(v.title).toMatch(title);
      if (!ISOLATED.has(kind)) expect(v.neighbours.length).toBeGreaterThan(0);
      expect(v.edges.length).toBeGreaterThanOrEqual(v.neighbours.length);
      expect(v.edges.map((e) => e.validFrom)).toEqual([...v.edges.map((e) => e.validFrom)].sort((a, b) => b - a));
    });

  t("every kind in the registry except the placeholder has a seeded test id", async () => {
    expect(Object.keys(SEEDED).sort()).toEqual(Object.keys(ITEM_KINDS).filter((k) => k !== "access-request").sort());
  });

  t("a system carries who-knows, the change that reaches it, and its sourced edges", async () => {
    const v = ItemView.parse(await (await get("system", "api-v1")).json());
    expect(v.whoKnows[0].personId).toBe("p-priya");
    expect(v.why.map((w) => w.changeId)).toContain("d-1");
    const w = v.why.find((x) => x.changeId === "d-1")!;
    expect(w.path[0].id).toBe("d-1");
    expect(w.path.at(-1)!.id).toBe("api-v1");
    expect(v.edges.some((e) => e.src && e.quote)).toBe(true);
  });

  t("an artifact exposes its source link and author as owner", async () => {
    const v = ItemView.parse(await (await get("pr", "art-pr-auth")).json());
    expect(v.sourceUrl).toMatch(/^\w+:\/\//);
    expect(v.owner).toBeTruthy();
  });

  t("404 for an unknown id, an unknown kind, the id of another kind and the access-request placeholder", async () => {
    for (const [k, i] of [["ticket", "nope"], ["nope", "x"], ["ticket", "api-v1"], ["access-request", "ar-1"], ["constructor", "x"]]) {
      const res = await get(k, i);
      expect(res.status, `${k}/${i}`).toBe(404);
      expect((await res.json()).error).toBe("not_found");
    }
  });
});
