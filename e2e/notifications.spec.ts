import { expect, test } from "@playwright/test";

// A non-zero sidebar notification count must not break hydration (React #418) on prerendered pages.
for (const route of ["/reports", "/agents"]) {
  test(`${route} with 3 open approvals shows the badge and no console or page errors`, async ({ page }) => {
    test.setTimeout(90_000);
    const problems: string[] = [];
    page.on("console", (msg) => { if (msg.type() === "error" && !msg.text().includes("/favicon.ico") && !msg.location().url.includes("/favicon.ico")) problems.push(`console: ${msg.text()}`); });
    page.on("pageerror", (err) => problems.push(`pageerror: ${err.message}`));
    await page.route("**/api/approvals?scope=open*", (r) => r.fulfill({ json: { approvals: [], open: 3 } }));
    await page.goto(route, { waitUntil: "networkidle" });
    await expect(page.locator('a[href="/reports?tab=activity"]').first()).toContainText("3"); // the sidebar is a closed drawer on mobile: check DOM text, not visibility
    expect(problems).toEqual([]);
  });
}
