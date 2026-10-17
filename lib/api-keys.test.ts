// API keys: hash-only storage, shown-once key, revoked -> 401, anonymous ack_brief -> 403, admin-only routes. Postgres part skips without DATABASE_URL; CI sets it.
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const authMock = vi.fn();
vi.mock("@clerk/nextjs/server", () => ({ auth: () => authMock() }));
vi.mock("./graph/schema", () => ({ ensureSchema: async () => {} }));
vi.mock("./graph/migrate", () => ({ migrateGraph: async () => [] })); // getContext migrates new org graphs (#165)
vi.mock("./graph/client", () => ({ graphFor: async (n: string) => ({ name: n }), readOnly: (g: unknown) => g }));

const url = process.env.DATABASE_URL;
const org = `test-org-${crypto.randomUUID()}`;
const as = (userId: string, orgRole: string) => authMock.mockResolvedValue({ userId, orgId: org, orgRole, orgSlug: org });
const keysReq = (method: string, body?: object) => new Request("http://x/api/org/keys", { method, body: body && JSON.stringify(body) });
const mcp = (key?: string, body: unknown = { jsonrpc: "2.0", id: 1, method: "tools/list" }) =>
  new Request("http://x/api/mcp", { method: "POST", headers: { ...(key && { authorization: `Bearer ${key}` }), "content-type": "application/json", accept: "application/json, text/event-stream" }, body: JSON.stringify(body) });

describe("anonymous MCP", () => {
  it("ack_brief is 403 (no key, read-only demo)", async () => {
    authMock.mockResolvedValue({ userId: null, orgId: null });
    const { POST } = await import("../app/api/mcp/route");
    const call = { jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "ack_brief", arguments: { decisionId: "d-1", teamId: "legal" } } };
    expect((await POST(mcp(undefined, call))).status).toBe(403);
  });
});

describe.skipIf(!url)("api keys (Postgres)", () => {
  beforeAll(async () => {
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = "pk_test_x";
    process.env.CLERK_SECRET_KEY = "sk_test_x";
    const { applyClerkEvent } = await import("./clerk-sync");
    for (const [u, role] of [["u_admin", "org:admin"], ["u_dev", "org:member"]])
      await applyClerkEvent({ type: "organizationMembership.created", data: { role, organization: { id: org, slug: org }, public_user_data: { user_id: u } } });
  });
  afterAll(async () => {
    delete process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
    delete process.env.CLERK_SECRET_KEY;
    const [{ db }, { orgs, auditLog }, { eq }] = await Promise.all([import("./db"), import("./db/schema"), import("drizzle-orm")]);
    await db().delete(orgs).where(eq(orgs.id, org)); // cascades api_keys
    await db().delete(auditLog).where(eq(auditLog.orgId, org));
  });

  it("non-admins get 403 on every verb", async () => {
    const { GET, POST, DELETE } = await import("../app/api/org/keys/route");
    as("u_dev", "org:member");
    expect((await GET(keysReq("GET"))).status).toBe(403);
    expect((await POST(keysReq("POST", { name: "x" }))).status).toBe(403);
    expect((await DELETE(keysReq("DELETE", { id: crypto.randomUUID() }))).status).toBe(403);
  });

  it("create shows the key once, stores only the hash; use touches last_used_at; revoke -> 401", async () => {
    const { GET, POST, DELETE } = await import("../app/api/org/keys/route");
    const { POST: mcpPost } = await import("../app/api/mcp/route");
    const [{ db }, { apiKeys }, { eq }, { hashKey }] = await Promise.all([import("./db"), import("./db/schema"), import("drizzle-orm"), import("./api-keys")]);
    as("u_admin", "org:admin");
    const made = await (await POST(keysReq("POST", { name: "laptop" }))).json();
    expect(made.key).toMatch(/^rpl_[0-9a-f]{8}_[0-9a-f]{48}$/);

    const [row] = await db().select().from(apiKeys).where(eq(apiKeys.id, made.id));
    expect(row.keyHash).toBe(hashKey(made.key));
    expect(JSON.stringify(row)).not.toContain(made.key.split("_")[2]); // the secret is nowhere in the row
    expect(JSON.stringify(await (await GET(keysReq("GET"))).json())).not.toContain(made.key.split("_")[2]);
    expect(row.lastUsedAt).toBeNull();

    authMock.mockResolvedValue({ userId: null, orgId: null }); // the key alone authenticates
    const ok = await mcpPost(mcp(made.key));
    expect(ok.status).toBe(200);
    expect((await db().select().from(apiKeys).where(eq(apiKeys.id, made.id)))[0].lastUsedAt).not.toBeNull();
    expect((await mcpPost(mcp("rpl_deadbeef_" + "0".repeat(48)))).status).toBe(401);

    as("u_admin", "org:admin");
    expect((await DELETE(keysReq("DELETE", { id: made.id }))).status).toBe(200);
    expect((await DELETE(keysReq("DELETE", { id: made.id }))).status).toBe(404);
    authMock.mockResolvedValue({ userId: null, orgId: null });
    expect((await mcpPost(mcp(made.key))).status).toBe(401);
  });
});
