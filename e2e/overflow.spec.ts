import { expect, test, type Page } from "@playwright/test";
import { ROUTES } from "./routes";

// #270: no route may pan sideways. Each page loads once, then the viewport steps down through the four widths.
const WIDTHS = [1440, 1280, 1024, 390];

const overflow = (page: Page) => page.evaluate(() => {
  const w = window.innerWidth;
  const sw = document.documentElement.scrollWidth;
  // Name the widest offender so a failure points at its source.
  let worst = "";
  if (sw > w) for (const el of document.body.querySelectorAll("*")) { const r = el.getBoundingClientRect(); if (r.right > w + 1 && r.width > 0) { worst = `${el.tagName.toLowerCase()}.${String(el.getAttribute("class") ?? "").slice(0, 80)}`; break; } }
  return { w, sw, worst };
});

test.describe("no horizontal overflow", () => {
  test.skip(({ viewport }) => viewport?.width !== 1440, "one project steps through every width");
  for (const route of ROUTES.filter((r) => !r.startsWith("/api/"))) {
    test(`${route} fits at ${WIDTHS.join("/")}`, async ({ page }) => {
      test.setTimeout(90_000);
      await page.goto(route, { waitUntil: "networkidle" });
      for (const width of WIDTHS) {
        await page.setViewportSize({ width, height: 900 });
        await page.waitForTimeout(150); // let layout and resize observers settle
        const o = await overflow(page);
        expect(o.sw, `${route} at ${width}: scrollWidth ${o.sw} > ${o.w} (${o.worst})`).toBeLessThanOrEqual(o.w);
      }
    });
  }

  test("a long unbroken URL in the Assistant does not pan the page at 390", async ({ page }) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/", { waitUntil: "networkidle" });
    const url = `https://example.com/${"a-very-long-path-segment".repeat(12)}?q=${"x".repeat(80)}`;
    const box = page.locator("textarea").first();
    await box.fill(url);
    await box.press("Enter");
    await expect(page.locator("main p[dir=auto]").filter({ hasText: url.slice(0, 40) }).first()).toBeVisible({ timeout: 15_000 });
    const o = await overflow(page);
    expect(o.sw, `scrollWidth ${o.sw} > ${o.w} (${o.worst})`).toBeLessThanOrEqual(o.w);
  });
});
