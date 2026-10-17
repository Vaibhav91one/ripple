import { afterAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const url = process.env.DATABASE_URL;

describe("db()", () => {
  it("throws a clear error when DATABASE_URL is unset", async () => {
    const prev = process.env.DATABASE_URL;
    delete process.env.DATABASE_URL;
    vi.resetModules();
    const { db } = await import("./index");
    expect(() => db()).toThrow(/DATABASE_URL/);
    if (prev) process.env.DATABASE_URL = prev;
  });
});

// skips locally when no Postgres is configured; CI sets DATABASE_URL
describe.skipIf(!url)("postgres tables", () => {
  const org = `test-org-${crypto.randomUUID()}`;

  afterAll(async () => {
    vi.resetModules();
    const { db } = await import("./index");
    const { orgs, auditLog } = await import("./schema");
    const { eq } = await import("drizzle-orm");
    await db().delete(orgs).where(eq(orgs.id, org)); // cascades memberships + api_keys
    await db().delete(auditLog).where(eq(auditLog.orgId, org));
  });

  it("seeds the demo org and round-trips a row in every table", async () => {
    const { db } = await import("./index");
    const { orgs, memberships, apiKeys, auditLog, connectorAccounts } = await import("./schema");
    const { eq } = await import("drizzle-orm");
    const d = db();

    const [demo] = await d.select().from(orgs).where(eq(orgs.id, "demo"));
    expect(demo).toMatchObject({ graphName: "demo", isDemo: true });

    await d.insert(orgs).values({ id: org, slug: org, graphName: org });
    const [o] = await d.select().from(orgs).where(eq(orgs.id, org));
    expect(o.isDemo).toBe(false);

    await d.insert(memberships).values({ orgId: org, userId: "u1", teamId: "t1", role: "lead" });
    const [m] = await d.select().from(memberships).where(eq(memberships.orgId, org));
    expect(m.role).toBe("lead");
    await expect(d.insert(memberships).values({ orgId: org, userId: "u1", teamId: "t1" })).rejects.toThrow();

    await d.insert(apiKeys).values({ orgId: org, keyHash: `h-${org}`, prefix: "rk_", name: "k", viewerUserId: "u1" });
    const [k] = await d.select().from(apiKeys).where(eq(apiKeys.orgId, org));
    expect(k.revokedAt).toBeNull();

    await d.insert(auditLog).values({ orgId: org, actorType: "user", action: "read", outcome: "allow", meta: { a: 1 } });
    const [a] = await d.select().from(auditLog).where(eq(auditLog.orgId, org));
    expect(a.meta).toEqual({ a: 1 });

    const acct = { orgId: org, kind: "slack", externalId: "T1", tokenEnc: "v1:aa:bb:cc:dd", scopes: ["chat:write"], cursor: { ts: "1" } };
    await d.insert(connectorAccounts).values(acct);
    const [c] = await d.select().from(connectorAccounts).where(eq(connectorAccounts.orgId, org));
    expect(c).toMatchObject({ status: "active", scopes: ["chat:write"], cursor: { ts: "1" }, lastSyncAt: null });
    await expect(d.insert(connectorAccounts).values(acct)).rejects.toThrow(); // unique(org_id, kind, external_id)
  });
});
