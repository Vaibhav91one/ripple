import { spawnSync } from "node:child_process";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const url = process.env.DATABASE_URL;
const ctx = (org: string, kind = "anon") => ({ org: { id: org }, viewer: { kind } });

afterEach(() => {
  if (url) process.env.DATABASE_URL = url;
  else delete process.env.DATABASE_URL;
  vi.restoreAllMocks();
  vi.resetModules();
});

describe("audit() without a usable database", () => {
  it("is a silent no-op without DATABASE_URL", async () => {
    delete process.env.DATABASE_URL;
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const { audit } = await import("./audit");
    await expect(audit(ctx("o"), { action: "change" })).resolves.toBeUndefined();
    expect(err).not.toHaveBeenCalled();
  });

  it("a DB outage never throws and logs once, not per call", async () => {
    process.env.DATABASE_URL = "postgres://x:x@127.0.0.1:1/x"; // nothing listens on port 1
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const { audit } = await import("./audit");
    for (let i = 0; i < 3; i++) await expect(audit(ctx("o"), { action: "change" })).resolves.toBeUndefined();
    expect(err).toHaveBeenCalledTimes(1);
  });
});

// skips locally when no Postgres is configured; CI sets DATABASE_URL
describe.skipIf(!url)("audit_log rows", () => {
  const org = `test-audit-${crypto.randomUUID()}`;
  const rows = async () => {
    const { db } = await import("./db");
    const { auditLog } = await import("./db/schema");
    const { eq } = await import("drizzle-orm");
    return db().select().from(auditLog).where(eq(auditLog.orgId, org));
  };

  it("an allowed write and a denied write each produce one row with the right actor_type", async () => {
    const { audit } = await import("./audit");
    await audit(ctx(org, "anon"), { action: "change", resourceType: "decision", resourceId: "d-1" });
    await audit(ctx(org, "user"), { action: "key.create", outcome: "deny", meta: { why: "role" } });
    await audit(ctx(org, "anon"), { action: "mcp.tool", read: true }); // anonymous reads are not logged
    const got = (await rows()).sort((a, b) => a.id - b.id);
    expect(got.map((r) => [r.action, r.actorType, r.outcome])).toEqual([
      ["change", "anon", "allow"],
      ["key.create", "user", "deny"],
    ]);
  });

  it("purge deletes rows older than 90 days only", async () => {
    const { db } = await import("./db");
    const { auditLog } = await import("./db/schema");
    const { eq } = await import("drizzle-orm");
    const day = 86_400_000;
    const base = { orgId: org, actorType: "system", outcome: "allow" } as const;
    await db().delete(auditLog).where(eq(auditLog.orgId, org));
    await db().insert(auditLog).values([
      { ...base, action: "old", at: new Date(Date.now() - 91 * day) },
      { ...base, action: "recent", at: new Date(Date.now() - 89 * day) },
    ]);
    const r = spawnSync("node", ["scripts/audit-purge.mjs"], { env: process.env, encoding: "utf8" });
    expect(r.status).toBe(0);
    expect((await rows()).map((x) => x.action)).toEqual(["recent"]);
    await db().delete(auditLog).where(eq(auditLog.orgId, org));
  });
});
