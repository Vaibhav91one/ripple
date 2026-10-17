// With Postgres configured, notifyGaps sends nothing itself: it emits brief.sent per gap team and proposes create_issue.
import { execSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { closeClient, graphFor, query, type Graph } from "./graph/client";
import { seed } from "./ingest/seed";

const { emit, propose, sendEmail } = vi.hoisted(() => ({
  emit: vi.fn<(tx: unknown, e: unknown) => Promise<{ inserted: boolean }>>(async () => ({ inserted: true })),
  propose: vi.fn<(ctx: unknown, kind: string, payload: unknown) => Promise<{ id: string }>>(async () => ({ id: "a1" })),
  sendEmail: vi.fn(),
}));
vi.mock("./events/emit", () => ({ emit }));
vi.mock("./actions/propose", () => ({ propose }));
vi.mock("./db", () => ({ db: () => ({}) }));
vi.mock("./notify/email", () => ({ sendEmail }));

const name = `test_b_${randomUUID().replaceAll("-", "")}`;
let g: Graph;
let up = false;
beforeAll(async () => {
  try {
    g = await graphFor(name);
    await query(g, "RETURN 1");
    up = true;
    await seed(name);
  } catch (e) {
    console.warn(`SKIPPING notify engine tests: FalkorDB unreachable (${String(e)})`);
  }
}, 30_000);
afterAll(async () => {
  try {
    if (up) await g.delete();
  } finally {
    await closeClient();
  }
});

describe("notifyGaps through the engine", () => {
  it("emits one brief.sent per gap team, proposes the issue, and sends nothing directly", async (ctx) => {
    if (!up) ctx.skip();
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    vi.stubEnv("DATABASE_URL", "postgres://x");
    const { notifyGaps } = await import("./notify");
    const res = await notifyGaps(g, "d-1", { now: 1_792_000_000, model: null, env: {}, baseUrl: "http://x", orgId: "org_1" });
    expect(res.map((r) => r.teamId).sort()).toEqual(["devrel", "legal", "security"]);
    expect(res.every((r) => r.email.status === "queued" && r.github.status === "proposed")).toBe(true);
    const events = emit.mock.calls.map((c) => c[1] as { type: string; orgId: string; dedupeKey: string; payload: { userId: string } });
    expect(events).toHaveLength(3);
    expect(events.every((e) => e.type === "brief.sent" && e.orgId === "org_1" && e.payload.userId)).toBe(true);
    expect(new Set(events.map((e) => e.dedupeKey)).size).toBe(3);
    expect(propose.mock.calls.map((c) => c[1])).toEqual(["create_issue", "create_issue", "create_issue"]);
    expect(sendEmail).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
    vi.unstubAllEnvs();
  });
});

// Only channel adapters and executors may talk to Resend or GitHub.
describe("direct sends", () => {
  it("live only in the email adapter and the executors", () => {
    const out = execSync(`grep -rlE 'from "resend"|api\\.github\\.com' lib app worker components --include=*.ts --include=*.tsx || true`, { encoding: "utf8" });
    const hits = out.split("\n").filter((f) => f && !f.endsWith(".test.ts"));
    expect(hits.sort()).toEqual(["lib/actions/executors.ts", "lib/notify/email.ts"]);
  });
});
