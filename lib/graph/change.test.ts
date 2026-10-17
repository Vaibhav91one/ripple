import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { closeClient, graphFor, query, type Graph } from "./client";
import { confirm, createDraft, getChange, materialDiff, supersede } from "./change";
import { ensureSchema } from "./schema";
import { seed } from "../ingest/seed";

const name = `test_change_${randomUUID().replaceAll("-", "")}`;
let g: Graph | undefined;
let up = false;

beforeAll(async () => {
  try {
    g = await graphFor(name);
    await query(g, "RETURN 1");
    up = true;
    await seed(name);
  } catch (e) {
    console.warn(`SKIPPING change tests: FalkorDB unreachable (${String(e)})`);
  }
}, 30_000);
afterAll(async () => {
  try {
    if (up && g) await g.delete();
  } finally {
    await closeClient();
  }
});

const base = { effectiveAt: 100, kind: "pricing" as const, systems: ["api-v1"] };
describe("materialDiff", () => {
  it("flags date, systems and kind; ignores order", () => {
    expect(materialDiff(base, { ...base, effectiveAt: 200 })).toBe(true);
    expect(materialDiff(base, { ...base, systems: ["api-v1", "billing"] })).toBe(true);
    expect(materialDiff(base, { ...base, kind: "policy" })).toBe(true);
    expect(materialDiff({ ...base, systems: ["a", "b"] }, { ...base, systems: ["b", "a"] })).toBe(false);
  });
});

describe("Change graph", () => {
  const t = (title: string, fn: () => Promise<void>) => it(title, async (ctx) => { if (!up) ctx.skip(); await fn(); });
  const count = async (cypher: string) => Number((await query<{ n: number }>(g!, cypher))[0].n);

  t("seeded d-1 is :Change:Decision and still matches Decision", async () => {
    expect(await count("MATCH (c:Change:Decision {id:'d-1', kind:'decision'}) RETURN count(c) AS n")).toBe(1);
    expect((await getChange(g!, "d-1"))?.status).toBe("confirmed");
    await ensureSchema(g!); // idempotent with the Change index
  });

  t("moved date is material, title typo is not", async () => {
    await createDraft(g!, { id: "ch-1", kind: "pricing", title: "Raise price", effectiveAt: 1000, systems: ["billing"] }, 1);
    expect(await confirm(g!, "ch-1", 2)).toBe(true);
    expect(await confirm(g!, "ch-1", 3)).toBe(false);

    const moved = await supersede(g!, "ch-1", { id: "ch-2", kind: "pricing", title: "Raise price", effectiveAt: 2000, systems: ["billing"] }, 4);
    expect(moved.material).toBe(true);
    const typo = await supersede(g!, "ch-2", { id: "ch-3", kind: "pricing", title: "Raise pricing", effectiveAt: 2000, systems: ["billing"] }, 5);
    expect(typo.material).toBe(false);

    expect((await getChange(g!, "ch-1"))?.status).toBe("superseded");
    expect(await count("MATCH (:Change {id:'ch-3'})-[:SUPERSEDES]->(:Change {id:'ch-2'})-[:SUPERSEDES]->(:Change {id:'ch-1'}) RETURN count(*) AS n")).toBe(1);
  });
});
