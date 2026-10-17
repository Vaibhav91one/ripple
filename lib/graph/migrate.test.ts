import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { closeClient, graphFor, query, type Graph } from "./client";
import { MIGRATIONS, migrateGraph } from "./migrate";
import { itemView } from "../items/view";
import { seed } from "../ingest/seed";

const name = `test_migrate_${randomUUID().replaceAll("-", "")}`;
let g: Graph;

beforeAll(async () => {
  await seed(name);
  g = await graphFor(name);
  // pre-#138 shape: decisions are plain :Decision, no Change label, no Change-only props
  await query(g, "MATCH (c:Change) REMOVE c:Change, c.kind, c.effective_at");
}, 60_000);
afterAll(async () => {
  await g?.delete().catch(() => {});
  await closeClient();
});

const count = async (cypher: string) => (await query<{ n: number }>(g, cypher))[0].n;

describe("migrateGraph", () => {
  it("starts in the old shape: decisions but no changes, and 'why' is empty", async () => {
    expect(await count("MATCH (d:Decision) RETURN count(d) AS n")).toBeGreaterThan(0);
    expect(await count("MATCH (c:Change) RETURN count(c) AS n")).toBe(0);
    expect((await itemView(g, "system", "api-v1")).data.why).toEqual([]);
  });

  it("adds :Change once, records it, and is a no-op the second time", async () => {
    expect(await migrateGraph(g)).toEqual(MIGRATIONS.map((m) => m.id));
    const n = await count("MATCH (c:Change) RETURN count(c) AS n");
    expect(n).toBeGreaterThan(0);
    expect(await count("MATCH (c:Change) WHERE c.kind IS NULL OR c.effective_at IS NULL RETURN count(c) AS n")).toBe(0);
    expect(await migrateGraph(g)).toEqual([]);
    expect(await count("MATCH (c:Change) RETURN count(c) AS n")).toBe(n);
    expect(await count("MATCH (m:Migration) RETURN count(m) AS n")).toBe(MIGRATIONS.length);
  });

  it("005 sets weight=1 on existing weighted edges, keeps a custom weight, and leaves other edges alone", async () => {
    const weighted = "MATCH ()-[r:DEPENDS_ON|USES|OWNS|GUARANTEES|PROMISED]->() ";
    await query(g, "MATCH ()-[r]->() REMOVE r.weight"); // pre-#212 shape: no edge has a weight
    await query(g, "MATCH (:System {id: 'auth-service'})-[r:DEPENDS_ON]->() SET r.weight = 7");
    await query(g, "MATCH (m:Migration {id: '005-edge-weight-default'}) DELETE m");
    expect(await migrateGraph(g)).toEqual(["005-edge-weight-default"]);
    expect(await count(weighted + "WHERE r.weight IS NULL RETURN count(r) AS n")).toBe(0);
    expect(await count(weighted + "WHERE r.weight = 1 RETURN count(r) AS n")).toBeGreaterThan(40);
    expect(await count("MATCH (:System {id: 'auth-service'})-[r:DEPENDS_ON]->() RETURN r.weight AS n")).toBe(7);
    expect(await count("MATCH ()-[r:SUNSETS]->() WHERE r.weight IS NOT NULL RETURN count(r) AS n")).toBe(0);
  });

  it("item 'why' rows for system api-v1 are non-empty after the migration", async () => {
    expect((await itemView(g, "system", "api-v1")).data.why.length).toBeGreaterThan(0);
  });
});
