// Self-healing (#125): an empty demo graph is re-seeded once, throttled to once a minute; health answers fast when FalkorDB is unreachable.
import { randomUUID } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { healDemo, nodeCount } from "./bootstrap";
import { closeClient, graphFor, query } from "./client";

const name = `test_heal_${randomUUID().replaceAll("-", "").slice(0, 12)}`;

describe("healDemo", () => {
  it("re-seeds an empty graph, at most once a minute", async (ctx) => {
    try {
      await query(await graphFor(name), "RETURN 1");
    } catch (e) {
      if (/ECONNREFUSED|connect/i.test(String(e))) return ctx.skip();
      throw e;
    }
    try {
      expect(await nodeCount(name)).toBe(0);
      const first = healDemo(name, 1_000_000);
      expect(first).toBeDefined();
      await first; // the seed is finished, not just started
      expect(await nodeCount(name)).toBeGreaterThan(0);

      await (await graphFor(name)).delete();
      expect(healDemo(name, 1_000_000 + 30_000)).toBeUndefined(); // inside the throttle window: no-op
      expect(await nodeCount(name)).toBe(0);
      const again = healDemo(name, 1_000_000 + 61_000); // window over: heals again
      expect(again).toBeDefined();
      await again;
      expect(await nodeCount(name)).toBeGreaterThan(0);
    } finally {
      await (await graphFor(name)).delete().catch(() => {});
      await closeClient();
    }
  }, 90_000);
});

describe("healDemo default clock", () => {
  it("never reads Date.now (Next logs it as an unstable prerender value on every request to /) and still throttles", async () => {
    const dn = vi.spyOn(Date, "now");
    try {
      const other = `test_heal_${randomUUID().replaceAll("-", "").slice(0, 12)}`;
      const sleep = healDemo(other); // first call starts a heal against the (unreachable or empty) graph
      expect(healDemo(other)).toBeUndefined(); // second call inside the window is throttled
      expect(dn).not.toHaveBeenCalled(); // checked before the seed runs: the seed itself may read the clock, that is not a prerender path
      await sleep;
      await (await graphFor(other)).delete().catch(() => {});
    } finally {
      dn.mockRestore();
      await closeClient().catch(() => {});
    }
  }, 90_000);
});

describe("GET /api/health with FalkorDB unreachable", () => {
  it("answers 503 falkordb:down within 3s", async () => {
    vi.resetModules();
    vi.doMock("next/server", () => ({ connection: async () => {} }));
    vi.stubEnv("FALKORDB_PORT", "1"); // nothing listens: the first connect never succeeds
    vi.stubEnv("RIPPLE_GRAPH", "");
    try {
      const { GET } = await import("../../app/api/health/route");
      const t = Date.now();
      const res = await GET();
      expect(Date.now() - t).toBeLessThan(3_000);
      expect(res.status).toBe(503);
      expect((await res.json()).falkordb).toBe("down");
      await (await import("./client")).closeClient().catch(() => {});
    } finally {
      vi.unstubAllEnvs();
    }
  });
});
