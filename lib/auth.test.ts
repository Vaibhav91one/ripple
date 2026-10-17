import { afterEach, describe, expect, it, vi } from "vitest";

const authMock = vi.fn();
vi.mock("@clerk/nextjs/server", () => ({ auth: () => authMock() }));
const ensureSchema = vi.fn();
vi.mock("./graph/schema", () => ({ ensureSchema: (g: unknown) => ensureSchema(g) }));
vi.mock("./graph/migrate", () => ({ migrateGraph: async () => [] }));
vi.mock("./graph/client", () => ({ graphFor: async (n: string) => ({ name: n }), readOnly: (g: unknown) => g }));

import { authEnabled, sessionViewer } from "./auth";
import { DEMO_GRAPH, getContext, graphNameFor } from "./server/context";

const KEYS = { NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_test_x", CLERK_SECRET_KEY: "sk_test_x" };
const setKeys = () => Object.entries(KEYS).forEach(([k, v]) => (process.env[k] = v));

afterEach(() => {
  for (const k of [...Object.keys(KEYS), "RIPPLE_AUTH"]) delete process.env[k];
  authMock.mockReset();
});

describe("authEnabled", () => {
  it("needs both keys and RIPPLE_AUTH != off", () => {
    expect(authEnabled({})).toBe(false);
    expect(authEnabled({ NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "a" })).toBe(false);
    expect(authEnabled({ ...KEYS })).toBe(true);
    expect(authEnabled({ ...KEYS, RIPPLE_AUTH: "off" })).toBe(false);
  });
});

describe("sessionViewer / getContext", () => {
  it("without keys or with RIPPLE_AUTH=off never calls Clerk: demo org", async () => {
    expect(await sessionViewer()).toBeNull();
    setKeys();
    process.env.RIPPLE_AUTH = "off";
    expect(await sessionViewer()).toBeNull();
    expect(authMock).not.toHaveBeenCalled();
    expect((await getContext()).org).toMatchObject({ id: "demo", isDemo: true });
  });

  it("signed out, no active org, or auth() throwing -> demo", async () => {
    setKeys();
    authMock.mockResolvedValueOnce({ userId: null, orgId: null });
    expect(await sessionViewer()).toBeNull();
    authMock.mockResolvedValueOnce({ userId: "user_1", orgId: null });
    expect(await sessionViewer()).toBeNull();
    authMock.mockRejectedValueOnce(new Error("no clerkMiddleware"));
    const c = await getContext();
    expect(c.viewer.kind).toBe("anon");
    expect(c.org.graphName).toBe(DEMO_GRAPH);
  });

  it("signed in with an active org -> that org's graph, admin role mapped", async () => {
    setKeys();
    authMock.mockResolvedValue({ userId: "user_1", orgId: "org_abc", orgRole: "org:admin" });
    const c = await getContext();
    expect(c.viewer).toEqual({ kind: "user", userId: "user_1", orgId: "org_abc", teamIds: [], role: "admin" });
    expect(c.org).toEqual({ id: "org_abc", graphName: "t_org_abc", isDemo: false });
    expect(ensureSchema).toHaveBeenCalledTimes(1);
    await getContext(); // second request: schema is not re-run
    expect(ensureSchema).toHaveBeenCalledTimes(1);
    authMock.mockResolvedValue({ userId: "user_2", orgId: "org_abc", orgRole: "org:member" });
    expect((await getContext()).viewer.role).toBe("member");
  });
});

describe("graphNameFor", () => {
  it("lowercases and replaces non-alphanumerics", () => {
    expect(graphNameFor("org_2Abc-X.y")).toBe("t_org_2abc_x_y");
  });
  it("demo never runs ensureSchema", async () => {
    await getContext();
    expect(ensureSchema).not.toHaveBeenCalled();
  });
});
