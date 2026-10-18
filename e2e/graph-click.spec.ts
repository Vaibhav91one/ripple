import { expect, test, type Page } from "@playwright/test";

// #265: the graph is drawn by <falkordb-canvas>. A real mouse click on a dot must select it (node panel, and ?node=
// on /graph), and Escape must close the panel. The dot's screen position comes from force-graph itself
// (graph2ScreenCoords), so the click is a genuine canvas hit-test, not a DOM shortcut.
async function clickNode(page: Page, title: string) {
  const host = page.locator("falkordb-canvas").first();
  await host.scrollIntoViewIfNeeded();
  const canvas = host.locator("canvas");
  await expect(canvas).toBeVisible({ timeout: 30_000 });
  await expect(canvas).toHaveAttribute("data-engine-status", "stopped", { timeout: 30_000 });
  await page.waitForTimeout(800); // zoomToFit lands after the engine stops
  const at = await host.evaluate((el, t) => {
    type N = { x: number; y: number; data: { title: string } };
    const c = el as unknown as { getGraphData: () => { nodes: N[] }; getGraph: () => { graph2ScreenCoords: (x: number, y: number) => { x: number; y: number } } };
    const n = c.getGraphData().nodes.find((x) => x.data.title === t);
    return n ? c.getGraph().graph2ScreenCoords(n.x, n.y) : null;
  }, title);
  expect(at, `${title} is in the graph`).not.toBeNull();
  const box = (await canvas.boundingBox())!;
  await page.mouse.click(box.x + at!.x, box.y + at!.y);
}

for (const route of ["/graph", "/analytics#graph"]) {
  test(`${route}: a mouse click on a dot opens its panel and Escape closes it`, async ({ page }) => {
    test.setTimeout(90_000);
    await page.goto(route, { waitUntil: "networkidle" });
    await clickNode(page, "API v1");
    const panel = page.getByRole("complementary", { name: "Node details" });
    await expect(panel).toBeVisible();
    await expect(panel.getByRole("heading", { name: "API v1" })).toBeVisible();
    if (route === "/graph") await expect(page).toHaveURL(/node=api-v1/);
    await page.keyboard.press("Escape");
    await expect(panel).toBeHidden();
  });
}
