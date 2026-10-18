import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const seedIfEmpty = vi.fn(async () => "seeded");
vi.mock("../graph/bootstrap", () => ({ seedIfEmpty, healDemo: vi.fn() }));
vi.mock("../graph/client", () => ({ graphFor: vi.fn(async (n: string) => ({ name: n })), readOnly: (g: unknown) => ({ ro: g }) }));
vi.mock("../graph/schema", () => ({ ensureSchema: vi.fn() }));
vi.mock("../graph/migrate", () => ({ migrateGraph: vi.fn(async () => []) }));

const KEYS = { NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk", CLERK_SECRET_KEY: "sk" };
const setEnv = (v: Record<string, string>) => Object.entries(v).forEach(([k, x]) => (process.env[k] = x));
const { getContext } = await import("./context");

beforeEach(() => { delete process.env.DATABASE_URL; delete process.env.RIPPLE_GRAPH; seedIfEmpty.mockClear(); });
afterEach(() => { for (const k of ["RIPPLE_MODE", "RIPPLE_AUTH", ...Object.keys(KEYS)]) delete process.env[k]; });

describe("getContext in local mode", () => {
  it("RIPPLE_MODE=local without Clerk: writable org `local`, admin viewer, graph t_local seeded once", async () => {
    setEnv({ RIPPLE_MODE: "local" });
    const [a, b] = await Promise.all([getContext(), getContext()]);
    expect(a.org).toEqual({ id: "local", graphName: "t_local", isDemo: false });
    expect(a.readonly).toBe(false);
    expect(a.viewer).toMatchObject({ kind: "user", userId: "local", orgId: "local", role: "admin" });
    expect(b.org.graphName).toBe("t_local");
    await getContext();
    expect(seedIfEmpty).toHaveBeenCalledTimes(1);
    expect(seedIfEmpty).toHaveBeenCalledWith("t_local");
  });

  it("without RIPPLE_MODE the public demo stays read-only and unseeded here", async () => {
    const c = await getContext();
    expect(c.org).toMatchObject({ id: "demo", isDemo: true });
    expect(c.readonly).toBe(true);
    expect(seedIfEmpty).not.toHaveBeenCalled();
  });

  it("Clerk keys present: local mode is ignored (signed-out viewers get the demo)", async () => {
    setEnv({ RIPPLE_MODE: "local", ...KEYS });
    const c = await getContext();
    expect(c.org.isDemo).toBe(true);
    expect(c.readonly).toBe(true);
  });

  it("RIPPLE_AUTH=off with keys still allows local mode", async () => {
    setEnv({ RIPPLE_MODE: "local", RIPPLE_AUTH: "off", ...KEYS });
    expect((await getContext()).org.id).toBe("local");
  });
});
