import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const audit = vi.fn<(ev: unknown) => Promise<void>>(async () => {});
const disconnect = vi.fn<(org: string, kind: string, id: string) => Promise<boolean>>(async () => true);
let ctx: Record<string, unknown> = {};
vi.mock("@/lib/env", () => ({ env: () => ({ DATABASE_URL: "postgres://x" }) }));
vi.mock("@/lib/connectors/state", () => ({ disconnect }));
vi.mock("@/lib/server/context", () => ({ getContext: async () => ctx }));

const ID = "7d3c2a9e-1f0b-4c8e-9a6d-2b5e8f1c4a70";
const post = (kind: string, body: unknown = { accountId: ID }) =>
  import("./route").then(({ POST }) => POST(new Request(`http://x/api/connectors/${kind}/disconnect`, { method: "POST", body: JSON.stringify(body) }), { params: Promise.resolve({ kind }) }));
const as = (viewer: Record<string, unknown>, readonly = false) => (ctx = { org: { id: "org-1" }, viewer, readonly, audit });

beforeEach(() => { audit.mockClear(); disconnect.mockClear(); disconnect.mockResolvedValue(true); });

describe("POST /api/connectors/[kind]/disconnect", () => {
  it("an admin disconnects the org's account, audited", async () => {
    as({ kind: "user", role: "admin", userId: "u1" });
    const res = await post("github");
    expect(res.status).toBe(200);
    expect(disconnect).toHaveBeenCalledWith("org-1", "github", ID);
    expect(audit).toHaveBeenCalledWith({ action: "connector.disconnect", resourceType: "connector_account", resourceId: ID, meta: { kind: "github" } });
  });
  it("a member is refused (403) and the denial is audited", async () => {
    as({ kind: "user", role: "member", userId: "u2" });
    expect((await post("slack")).status).toBe(403);
    expect(disconnect).not.toHaveBeenCalled();
    expect(audit.mock.calls[0][0]).toMatchObject({ action: "connector.disconnect", outcome: "deny" });
  });
  it("the read-only demo gets 403", async () => {
    as({ kind: "anon", role: "member" }, true);
    expect((await post("github")).status).toBe(403);
    expect(disconnect).not.toHaveBeenCalled();
  });
  it("another org's account (or a missing one) is 404", async () => {
    as({ kind: "user", role: "admin", userId: "u1" });
    disconnect.mockResolvedValue(false);
    expect((await post("github")).status).toBe(404);
    expect(audit).not.toHaveBeenCalled();
  });
  it("unknown kinds and bad bodies are rejected", async () => {
    as({ kind: "user", role: "admin", userId: "u1" });
    expect((await post("csv")).status).toBe(404);
    expect((await post("github", { accountId: "nope" })).status).toBe(400);
  });
});
