import { expect, test } from "@playwright/test";

// The flowchart cards hold pointer capture while pressed; a plain mouse click must still select a node (#234),
// and Escape must close the node panel. Runs on /graph and on the copy embedded in /analytics.
for (const route of ["/graph", "/analytics#graph"]) {
  test(`${route}: a mouse click on a node opens its panel and Escape closes it`, async ({ page }) => {
    test.setTimeout(90_000);
    await page.goto(route, { waitUntil: "networkidle" });
    const node = page.locator("[data-node] button").first();
    await node.scrollIntoViewIfNeeded();
    await node.click();
    const panel = page.getByRole("complementary", { name: "Node details" });
    await expect(panel).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(panel).toBeHidden();
  });
}
