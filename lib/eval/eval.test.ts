import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, expect, it } from "vitest";
import { closeClient, graphFor, query, type Graph } from "../graph/client";
import { seed } from "../ingest/seed";
import { evaluate, QUESTIONS } from "./questions";

const name = `test_v_${randomUUID().replaceAll("-", "")}`;
let g: Graph;
let up = false;

beforeAll(async () => {
  try {
    g = await graphFor(name);
    await query(g, "RETURN 1");
    up = true;
    await seed(name);
  } catch (e) {
    console.warn(`SKIPPING eval test: FalkorDB unreachable (${String(e)})`);
  }
}, 30_000);

afterAll(async () => {
  try {
    if (up) await g.delete();
  } finally {
    await closeClient();
  }
});

it("all 15 eval questions pass on a fresh seed", async (ctx) => {
  if (!up) ctx.skip();
  const rows = await evaluate(g);
  expect(rows).toHaveLength(15);
  expect(QUESTIONS).toHaveLength(15);
  expect(rows.filter((r) => !r.pass)).toEqual([]);
}, 30_000);
