// Members, the admin-only PATCH route and the signed-in viewer fill. Postgres part skips without DATABASE_URL; CI sets it.
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const authMock = vi.fn();
vi.mock("@clerk/nextjs/server", () => ({ auth: () => authMock() }));
vi.mock("./graph/schema", () => ({ ensureSchema: async () => {} }));
vi.mock("./graph/client", () => ({ graphFor: async (n: string) => ({ name: n }), readOnly: (g: unknown) => g }));

const url = process.env.DATABASE_URL;
const org = `test-org-${crypto.randomUUID()}`;
const patch = (body: unknown) => new Request("http://x/api/org/members", { method: "PATCH", body: JSON.stringify(body) });
const as = (userId: string, orgRole: string) => authMock.mockResolvedValue({ userId, orgId: org, orgRole, orgSlug: org });

describe.skipIf(!url)("memberships", () => {
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
    await db().delete(orgs).where(eq(orgs.id, org));
    await db().delete(auditLog).where(eq(auditLog.orgId, org));
  });

  it("403 and a deny audit row for a non-admin, nothing changes", async () => {
    const { PATCH } = await import("../app/api/org/members/route");
    as("u_dev", "org:member");
    expect((await PATCH(patch({ userId: "u_dev", role: "admin" }))).status).toBe(403);
    const [{ db }, { auditLog }, { eq }, { getMember }] = await Promise.all([import("./db"), import("./db/schema"), import("drizzle-orm"), import("./members")]);
    const rows = await db().select().from(auditLog).where(eq(auditLog.orgId, org));
    expect(rows).toMatchObject([{ action: "member.update", outcome: "deny", actorId: "u_dev" }]);
    expect((await getMember(org, "u_dev"))?.role).toBe("member");
  });

  it("admin PATCH sets teams, role and person; getContext reads them back; Clerk admin wins", async () => {
    const { PATCH } = await import("../app/api/org/members/route");
    const { getContext } = await import("./server/context");
    as("u_admin", "org:admin");
    expect((await PATCH(patch({ userId: "u_dev", teamIds: ["eng", "security"], role: "lead", personId: "p1" }))).status).toBe(200);
    expect((await PATCH(patch({ userId: "u_dev", teamIds: ["eng"] }))).status).toBe(200); // drops security, keeps role
    expect((await PATCH(patch({ userId: "nobody", role: "lead" }))).status).toBe(404);
    expect((await PATCH(patch({ userId: "u_dev", role: "root" }))).status).toBe(400);

    as("u_dev", "org:member");
    expect((await getContext()).viewer).toMatchObject({ kind: "user", userId: "u_dev", teamIds: ["eng"], role: "lead", personId: "p1" });
    await PATCH(patch({ userId: "u_admin", role: "member" })).catch(() => {});
    as("u_admin", "org:admin");
    expect((await getContext()).viewer.role).toBe("admin"); // '*' row says admin; and a demoted row would not override Clerk
  });
});

describe("no database", () => {
  it("PATCH is 403 for the anonymous demo", async () => {
    authMock.mockResolvedValue({ userId: null, orgId: null });
    const { PATCH } = await import("../app/api/org/members/route");
    expect((await PATCH(patch({ userId: "x" }))).status).toBe(403);
  });
});
