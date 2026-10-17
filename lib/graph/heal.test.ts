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
      healDemo(name, 1_000_000);
      await expect.poll(() => nodeCount(name), { timeout: 30_000, interval: 250 }).toBeGreaterThan(0);

      await (await graphFor(name)).delete();
      healDemo(name, 1_000_000 + 30_000); // inside the throttle window: no-op
      await new Promise((r) => setTimeout(r, 1_500));
      expect(await nodeCount(name)).toBe(0);
      healDemo(name, 1_000_000 + 61_000); // window over: heals again
      await expect.poll(() => nodeCount(name), { timeout: 30_000, interval: 250 }).toBeGreaterThan(0);
    } finally {
      await (await graphFor(name)).delete().catch(() => {});
      await closeClient();
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
