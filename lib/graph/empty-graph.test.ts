// A graph key that doesn't exist yet reads as empty instead of erroring (fresh volume, new org).
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { graphFor, roQuery } from "./client";
import { nodeCount } from "./bootstrap";

describe("reads on a missing graph", () => {
  it("roQuery returns [] and nodeCount returns 0", async (ctx) => {
    const name = `test_missing_${randomUUID().slice(0, 8)}`;
    let g;
    try {
      g = await graphFor(name);
      await roQuery(g, "RETURN 1");
    } catch (e) {
      if (/ECONNREFUSED|connect/i.test(String(e))) return ctx.skip();
      throw e;
    }
    expect(await roQuery(g, "MATCH (n) RETURN count(n) AS n")).toEqual([]);
    expect(await nodeCount(name)).toBe(0);
  });
});
