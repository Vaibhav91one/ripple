// README graph screenshots: pnpm graph:shot [--base http://localhost:3000] [--out docs/screens/graph]
// Captures /graph (the whole company graph) and the ripple of one change (/reports/d-1, its graph card) once the
// <falkordb-canvas> force layout has stopped (data-engine-status="stopped"), so reruns give the same picture.
import { chromium, type Page } from "playwright-core";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";

const { values } = parseArgs({ options: { base: { type: "string", default: "http://localhost:3000" }, out: { type: "string", default: "docs/screens/graph" } } });
const base = values.base!, out = values.out!;

/** Wait until every graph canvas on the page has data and its engine has stopped, then let zoomToFit land. */
async function settled(page: Page) {
  await page.locator("falkordb-canvas canvas").first().waitFor({ state: "attached", timeout: 60_000 });
  await page.waitForFunction(() => {
    const cs = [...document.querySelectorAll("falkordb-canvas")].map((el) => el.shadowRoot?.querySelector("canvas"));
    return cs.length > 0 && cs.every((c) => c?.getAttribute("data-engine-status") === "stopped");
  }, undefined, { timeout: 60_000 });
  await page.waitForTimeout(1200);
}

async function main() {
  mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({ channel: "chrome" });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();

  await page.goto(new URL("/graph", base).href, { waitUntil: "networkidle" });
  await settled(page);
  await page.screenshot({ path: join(out, "graph-1440.png") });

  await page.goto(new URL("/reports/d-1", base).href, { waitUntil: "networkidle" });
  const card = page.locator("#graph");
  await card.scrollIntoViewIfNeeded();
  await settled(page);
  await card.screenshot({ path: join(out, "ripple-d1.png") });

  await browser.close();
  console.log(`wrote ${join(out, "graph-1440.png")} and ${join(out, "ripple-d1.png")}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
