import { afterAll, describe, expect, it, vi } from "vitest";
import { spawn } from "node:child_process";

vi.mock("server-only", () => ({}));
const url = process.env.DATABASE_URL;
// Own pg-boss schema per run: another suite on the same Postgres must not consume (or feed) our jobs.
const schema = `test_boss_${crypto.randomUUID().replaceAll("-", "").slice(0, 12)}`;
process.env.PGBOSS_SCHEMA = schema;

describe.skipIf(!url)("queue + worker (Postgres)", () => {
  afterAll(async () => {
    const { queue } = await import("../lib/queue");
    await (await queue())?.stop({ graceful: false });
    const sql = (await import("postgres")).default(url!, { max: 1, onnotice: () => {} });
    await sql.unsafe(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    await sql.end();
    delete process.env.PGBOSS_SCHEMA;
  });

  it("processes an enqueued job in-process and singletonKey dedupes", async () => {
    const { startWorker } = await import("./index");
    const { enqueue } = await import("../lib/queue");
    const seen: string[] = [];
    const stop = await startWorker(url!, { "route-event": async (jobs) => { seen.push(...jobs.map((j) => j.data.n)); } });
    const key = `k-${Date.now()}`;
    const a = await enqueue("route-event", { n: "first" }, { singletonKey: key });
    const b = await enqueue("route-event", { n: "dupe" }, { singletonKey: key });
    expect(a).toBeTruthy();
    expect(b).toBeNull();
    await vi.waitFor(() => expect(seen).toEqual(["first"]), { timeout: 10_000 });
    await stop();
  }, 30_000);

  it("worker exits cleanly on SIGTERM", async () => {
    const p = spawn("node", ["--import", "tsx", "worker/index.ts"], { env: { ...process.env, DATABASE_URL: url } });
    let out = "";
    p.stdout.on("data", (d) => (out += d));
    await vi.waitFor(() => expect(out).toContain("ready"), { timeout: 20_000 });
    p.kill("SIGTERM");
    const code = await new Promise((r) => p.on("exit", r));
    expect(code).toBe(0);
  }, 40_000);
});

describe("without DATABASE_URL", () => {
  it("enqueue is a no-op", async () => {
    vi.stubEnv("DATABASE_URL", "");
    const { enqueue } = await import("../lib/queue");
    expect(await enqueue("noop", {})).toBeNull();
    vi.unstubAllEnvs();
  });
});
