import { expect, test } from "vitest";
import nextConfig from "@/next.config";
import { activeHref } from "./nav";

test("sub-pages keep their parent nav item active", () => {
  expect(activeHref("/")).toBe("/");
  expect(activeHref("/reports")).toBe("/reports");
  expect(activeHref("/reports/chg-1")).toBe("/reports");
  expect(activeHref("/reportsx")).toBeUndefined();
  expect(activeHref("/settings/members")).toBe("/settings");
  expect(activeHref("/profile")).toBeUndefined();
});

test("v1 routes 308 to their v2 home", async () => {
  const rules = await nextConfig.redirects!();
  const to = (source: string) => rules.find((r) => r.source === source);
  const expected: Record<string, string> = {
    "/home": "/", "/changes": "/reports", "/changes/:id": "/reports/:id", "/overview": "/analytics", "/approvals": "/",
    "/it": "/reports?kind=access", "/graph": "/analytics#graph", "/teams/:team": "/agents?team=:team", "/inbox": "/", "/connectors": "/connections",
  };
  for (const [source, destination] of Object.entries(expected)) {
    expect(to(source), source).toMatchObject({ destination, permanent: true });
  }
});

test("the user card shows the demo, local or signed-in identity", async () => {
  const { shellUser } = await import("./identity");
  expect(shellUser({})).toMatchObject({ name: "Demo visitor", role: "Viewer" });
  expect(shellUser({ RIPPLE_MODE: "local" })).toMatchObject({ name: "Local workspace", role: "Admin" });
  expect(shellUser({ NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_test_x", CLERK_SECRET_KEY: "sk_test_x", RIPPLE_MODE: "local" }).name).toBe("Your workspace");
});

test("local mode (no Clerk) is the local workspace; Clerk keys win", async () => {
  const { isLocalMode } = await import("./identity");
  expect(isLocalMode({ RIPPLE_MODE: "local" })).toBe(true);
  expect(isLocalMode({})).toBe(false);
  expect(isLocalMode({ NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_test_x", CLERK_SECRET_KEY: "sk_test_x", RIPPLE_MODE: "local" })).toBe(false);
});
