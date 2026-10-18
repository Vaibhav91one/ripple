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
