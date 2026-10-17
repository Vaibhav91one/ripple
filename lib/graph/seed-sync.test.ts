// #217: an old-version demo-like graph is rebuilt to the current seed without ever reading empty; same version is a no-op.
import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { nodeCount, syncSeed } from "./bootstrap";
import { closeClient, graphFor, query } from "./client";
import { SEED_VERSION, seed } from "../ingest/seed";

const name = `test_sync_${randomUUID().replaceAll("-", "").slice(0, 12)}`;
const fresh = `${name}_fresh`;
const count = async (g: string, cy: string) => (await query<{ n: number }>(await graphFor(g), cy))[0].n;
const deps = (g: string) => count(g, "MATCH ()-[r:DEPENDS_ON]->() RETURN count(r) AS n");

afterAll(async () => {
  for (const n of [name, `${name}_next`, fresh]) await (await graphFor(n)).delete().catch(() => {});
  await closeClient();
});

describe("syncSeed", () => {
  it("rebuilds an old-version graph to the full seed with no empty window, and skips when current", async () => {
    await seed(fresh);
    const want = { deps: await deps(fresh), nodes: await nodeCount(fresh) };
    expect(want.deps).toBeGreaterThan(1);

    // an old demo: one DEPENDS_ON edge and a stale version
    await query(await graphFor(name), "CREATE (:System {id:'a'})-[:DEPENDS_ON]->(:System {id:'b'}), (:SeedInfo {k:'seed', version:'old', at:1})");
    expect(await nodeCount(name)).toBe(2); // SeedInfo is not counted

    let empty = 0, reads = 0, done = false;
    const poll = (async () => {
      while (!done) {
        reads++;
        if ((await nodeCount(name)) === 0) empty++;
      }
    })();
    const r = await syncSeed(name);
    done = true;
    await poll;
    expect(r).toBe(`reseeded: old -> ${SEED_VERSION}`);
    expect(reads).toBeGreaterThan(5); // reads really overlapped the rebuild
    expect(empty).toBe(0);
    expect({ deps: await deps(name), nodes: await nodeCount(name) }).toEqual(want);
    expect(await count(name, `MATCH (s:SeedInfo) WHERE s.version = '${SEED_VERSION}' RETURN count(s) AS n`)).toBe(1);
    expect(await count(name, "MATCH (m:Migration) RETURN count(m) AS n")).toBeGreaterThan(0);
    expect(await nodeCount(`${name}_next`)).toBe(0); // temp key renamed away

    // same version: fast path leaves a marker node untouched
    await query(await graphFor(name), "CREATE (:Marker {id:'keep'})");
    expect(await syncSeed(name)).toBe("present");
    expect(await count(name, "MATCH (x:Marker) RETURN count(x) AS n")).toBe(1);
  }, 120_000);
});
