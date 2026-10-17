import { spawnSync } from "node:child_process";
import { afterEach, describe, expect, it } from "vitest";
import { DEMO_GRAPH, getContext } from "./context";

afterEach(() => {
  delete process.env.RIPPLE_GRAPH;
  delete process.env.RIPPLE_NOW;
});

describe("getContext", () => {
  it("is the demo org with a read-only graph, a writer, and a pinned clock", async () => {
    process.env.RIPPLE_NOW = "2026-10-17T09:00:00Z";
    const c = await getContext();
    expect(c.org).toEqual({ id: "demo", graphName: DEMO_GRAPH, isDemo: true });
    expect(c.viewer).toEqual({ kind: "anon", orgId: "demo", teamIds: ["eng"], role: "change_owner" });
    expect(c.now).toBe(Date.parse("2026-10-17T09:00:00Z") / 1000);
    expect(c.writer()).not.toBe(c.graph);
  });

  it("RIPPLE_GRAPH overrides the graph name (tests only)", async () => {
    process.env.RIPPLE_GRAPH = "tmp-x";
    expect((await getContext()).org.graphName).toBe("tmp-x");
  });
});

describe("single graph resolver", () => {
  it("no graphFor/selectGraph with a string literal outside client.ts, context.ts and tests", () => {
    const out = spawnSync("git", ["grep", "-nE", "(graphFor|selectGraph)\\(\\s*[\"'`]", "--", "lib", "app", "scripts", "instrumentation.ts"], { encoding: "utf8" }).stdout;
    const hits = out.split("\n").filter((l) => l && !/\.test\.ts|lib\/graph\/client\.ts|lib\/server\/context\.ts/.test(l));
    expect(hits).toEqual([]);
  });
});
