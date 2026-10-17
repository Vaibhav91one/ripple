// Visual-check screenshots: pnpm shots --base <url> [--routes a,b] [--lens legal] [--out .shots]
import { chromium } from "playwright-core";
import { mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";

const { values } = parseArgs({
  options: { base: { type: "string" }, routes: { type: "string" }, lens: { type: "string" }, out: { type: "string", default: ".shots" } },
});
if (!values.base) {
  console.error("usage: pnpm shots --base <url> [--routes a,b] [--lens legal] [--out .shots]");
  process.exit(2);
}
const base = new URL(values.base);
const out = values.out!;
const routes: string[] = values.routes
  ? values.routes.split(",")
  : JSON.parse(readFileSync(join(__dirname, "shots.routes.json"), "utf8"));
const sizes = [
  { width: 1440, height: 900 },
  { width: 390, height: 844 },
];
const slug = (r: string) => r.replace(/^\/|\/$/g, "").replace(/\//g, "-") || "home";

async function main() {
  const browser = await chromium.launch({ channel: "chrome" });
  const rows: { route: string; width: number; status: number | string; errors: number }[] = [];
  let failed = false;
  for (const size of sizes) {
    const ctx = await browser.newContext({ viewport: size, reducedMotion: "reduce" });
    if (values.lens) await ctx.addCookies([{ name: "ripple_lens", value: values.lens, domain: base.hostname, path: "/" }]);
    mkdirSync(join(out, String(size.width)), { recursive: true });
    for (const route of routes) {
      const page = await ctx.newPage();
      const errors: string[] = [];
      page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
      page.on("pageerror", (e) => errors.push(e.message));
      let status: number | string = "-";
      try {
        status = (await page.goto(new URL(route, base).href, { waitUntil: "networkidle" }))?.status() ?? "-";
        await page.screenshot({ path: join(out, String(size.width), `${slug(route)}.png`), fullPage: true });
      } catch (e) {
        errors.push(String(e));
      }
      if (errors.length || status === "-" || (typeof status === "number" && status >= 500)) failed = true;
      for (const e of errors) console.error(`  ${size.width} ${route}: ${e.split("\n")[0]}`);
      rows.push({ route, width: size.width, status, errors: errors.length });
      await page.close();
    }
    await ctx.close();
  }
  await browser.close();
  console.table(rows);
  console.log(`${failed ? "FAIL" : "ok"}: screenshots in ${out}/`);
  process.exit(failed ? 1 : 0);
}
main();
