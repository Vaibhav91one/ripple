// Records the read-only walkthrough (steps 1-5 of docs/demo-script.md) on the public demo:
//   pnpm demo:record [--base https://ripple.vaibhav.quest]  ->  docs/demo.webm + docs/demo.gif (needs ffmpeg)
// Read-only: only navigates, scrolls, opens toggles. Never clicks a write action, never calls /api/reset.
import { chromium, type Locator, type Page } from "playwright-core";
import { execFileSync } from "node:child_process";
import { mkdirSync, readdirSync, renameSync, rmSync } from "node:fs";
import { parseArgs } from "node:util";

const { values } = parseArgs({ options: { base: { type: "string", default: "https://ripple.vaibhav.quest" } } });
const base = values.base!;
const tmp = ".demo-rec";
const ffmpeg = process.env.FFMPEG ?? "/opt/homebrew/bin/ffmpeg";

// A visible cursor dot that follows the (Playwright-driven) mouse.
const CURSOR = `addEventListener("DOMContentLoaded", () => {
  const d = document.createElement("div");
  d.style.cssText = "position:fixed;z-index:2147483647;width:18px;height:18px;margin:-9px 0 0 -9px;border-radius:50%;background:rgba(255,80,60,.55);border:2px solid #fff;pointer-events:none;left:-50px;top:0";
  document.documentElement.append(d);
  addEventListener("mousemove", (e) => { d.style.left = e.clientX + "px"; d.style.top = e.clientY + "px"; }, true);
});`;

const beat = (page: Page, ms = 1200) => page.waitForTimeout(ms); // a deliberate pause so the viewer can read

async function glide(page: Page, el: Locator) {
  await el.scrollIntoViewIfNeeded();
  const b = await el.boundingBox();
  if (b) await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 25 });
}
async function click(page: Page, el: Locator) {
  await glide(page, el);
  await beat(page, 400);
  await el.click();
}
// Walk the page down in small steps (explicit scroll, no long blind sleep).
async function scroll(page: Page, px: number) {
  for (let i = 0; i < px / 100; i++) { await page.mouse.wheel(0, 100); await page.waitForTimeout(80); }
}
async function go(page: Page, path: string, ready: Locator) {
  await page.goto(new URL(path, base).href, { waitUntil: "domcontentloaded" });
  await ready.first().waitFor({ timeout: 30_000 });
  await page.waitForLoadState("networkidle").catch(() => {});
  await beat(page);
}

async function main() {
  rmSync(tmp, { recursive: true, force: true });
  mkdirSync(tmp, { recursive: true });
  const browser = await chromium.launch({ channel: "chrome" });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, recordVideo: { dir: tmp, size: { width: 1440, height: 900 } } });
  await ctx.addInitScript(CURSOR);
  const page = await ctx.newPage();

  // 1. Assistant: the sunset suggestion, the streamed answer, the Cypher toggle.
  await go(page, "/", page.getByRole("heading").first());
  await click(page, page.getByLabel("Starter prompts").getByRole("button", { name: /What does sunsetting API v1 touch/ }));
  const checked = page.getByText(/^Checked \d+ source/).first();
  await checked.waitFor({ timeout: 60_000 }); // the tool row appears once the answer has streamed
  await page.getByText(/Sources \(\d+\)/).first().waitFor({ timeout: 60_000 }); // answer finished
  await beat(page, 2500);
  await click(page, checked);
  await click(page, page.getByRole("button").filter({ hasText: /results?$/ }).first()); // the Cypher the tool ran
  await beat(page, 3500);
  await scroll(page, 500); // down to the answer and its card
  await beat(page, 2500);

  // 2. Reports: list, then the case file with the conflict card and a source quote.
  await go(page, "/reports", page.getByRole("link", { name: /v1/i }));
  await glide(page, page.locator("a[href='/reports/d-1']").first());
  await beat(page, 1500);
  await go(page, "/reports/d-1", page.getByText(/conflict/i));
  await glide(page, page.getByText(/conflict/i).first());
  await beat(page, 2000);
  await scroll(page, 500);
  await beat(page, 2000);
  await scroll(page, 600);
  await beat(page, 2000);

  // 3. Analytics: scroll the cards down to the graph explorer.
  await go(page, "/analytics", page.getByRole("heading").first());
  await page.waitForTimeout(2000);
  await scroll(page, 1200);
  await beat(page, 2500);
  await scroll(page, 1200);
  await beat(page, 2500);

  // 4. Agents (look, do not run).
  await go(page, "/agents", page.getByRole("heading").first());
  await beat(page, 2500);
  await scroll(page, 400);
  await beat(page, 1500);

  // 5. Integrations, then connections.
  await go(page, "/integrations", page.getByRole("heading").first());
  await beat(page, 2500);
  await go(page, "/connections", page.getByRole("heading").first());
  await beat(page, 2500);

  await ctx.close(); // flushes the video
  await browser.close();

  const webm = readdirSync(tmp).find((f) => f.endsWith(".webm"))!;
  renameSync(`${tmp}/${webm}`, "docs/demo.webm");
  // GIF: palette method, 800px wide, 10 fps.
  const vf = "fps=10,scale=800:-1:flags=lanczos";
  execFileSync(ffmpeg, ["-y", "-v", "error", "-i", "docs/demo.webm", "-vf", `${vf},palettegen=max_colors=96:stats_mode=diff`, `${tmp}/p.png`]);
  execFileSync(ffmpeg, ["-y", "-v", "error", "-i", "docs/demo.webm", "-i", `${tmp}/p.png`, "-lavfi", `${vf}[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle`, "docs/demo.gif"]);
  rmSync(tmp, { recursive: true, force: true });
  console.log("wrote docs/demo.webm and docs/demo.gif");
}

main().catch((e) => { console.error(e); process.exit(1); });
