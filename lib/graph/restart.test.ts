// FalkorDB restart: queries fail fast while it is down, and the same process recovers once it is back (#125).
// Needs a throwaway container: container run -d --name falkor-rs -p 6391:6379 falkordb/falkordb:6.0.2
// then FALKOR_RESTART_CONTAINER=falkor-rs FALKORDB_PORT=6391 pnpm vitest run lib/graph/restart.test.ts
import { execFileSync } from "node:child_process";
import { afterAll, describe, expect, it } from "vitest";
import { closeClient, graphFor, query } from "./client";

const name = process.env.FALKOR_RESTART_CONTAINER;
const ping = async () => query(await graphFor("test_restart"), "RETURN 1 AS n");

describe.skipIf(!name)("FalkorDB restart", () => {
  afterAll(async () => {
    execFileSync("container", ["start", name!], { stdio: "ignore" });
    await closeClient().catch(() => {});
  });

  it("fails fast while down, recovers after start, no process restart", async () => {
    expect(await ping()).toEqual([{ n: 1 }]);
    execFileSync("container", ["stop", name!], { stdio: "ignore" });
    const t = Date.now();
    await expect(ping()).rejects.toThrow();
    expect(Date.now() - t).toBeLessThan(10_000);
    execFileSync("container", ["start", name!], { stdio: "ignore" });
    await expect.poll(() => ping().catch(() => null), { timeout: 30_000, interval: 500 }).toEqual([{ n: 1 }]);
  }, 90_000);
});
