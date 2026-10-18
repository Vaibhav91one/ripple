// GET /api/me in demo and local modes (no Clerk keys). getContext only names a temp graph; nothing is written.
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { closeClient } from "@/lib/graph/client";
import { GET } from "./route";

const keys = ["RIPPLE_MODE", "RIPPLE_GRAPH", "RIPPLE_AUTH", "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "CLERK_SECRET_KEY"] as const;
const saved = Object.fromEntries(keys.map((k) => [k, process.env[k]]));

beforeAll(() => {
  process.env.RIPPLE_GRAPH = "test_me_unused";
  process.env.RIPPLE_AUTH = "off";
});
afterEach(() => { delete process.env.RIPPLE_MODE; });
afterAll(async () => {
  for (const k of keys) if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k];
  await closeClient();
});

const get = async () => (await GET(new Request("http://t/api/me"))).json();

describe("GET /api/me", () => {
  it("demo: the anonymous visitor, read through the default lens", async () => {
    const body = await get();
    expect(body).toEqual({ mode: "demo", name: "Demo visitor", role: "Viewer", org: "Ledgerly", initials: "DV", teamIds: ["eng"], lens: "change-owner" });
  });

  it("local: the one admin workspace, no account", async () => {
    process.env.RIPPLE_MODE = "local";
    const body = await get();
    expect(body).toMatchObject({ mode: "local", name: "Local workspace", role: "Admin", org: "local", lens: "change-owner" });
  });

  it("never returns secrets or tokens", async () => {
    process.env.CLERK_SECRET_KEY = "sk_test_SENTINEL";
    const text = JSON.stringify(await get());
    expect(text).not.toMatch(/SENTINEL|sk_|token|secret/i);
    expect(Object.keys(JSON.parse(text)).sort()).toEqual(["initials", "lens", "mode", "name", "org", "role", "teamIds"]);
  });
  it("is never cached across viewers", async () => {
    const res = await GET(new Request("http://t/api/me"));
    expect(res.headers.get("cache-control")).toBe("private, no-store");
  });
});
