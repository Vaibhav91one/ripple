import { expect, test } from "@playwright/test";
import { ROUTES } from "./routes";

// Known third-party console noise, matched as substrings. Keep it explicit; add an entry only with a comment saying why.
const ALLOWED_CONSOLE_ERRORS: string[] = [
  // Browser-issued favicon request: the JSON page /api/health has no <link rel="icon">, so Chrome asks for /favicon.ico and gets 404.
  "/favicon.ico",
  // Clerk logs 400s from its domain/key check when publishable keys do not match the host (local and self-hosted runs have no Clerk keys).
];

for (const route of ROUTES) {
  test(`${route} loads with a 2xx/3xx status and no console or page errors`, async ({ page }) => {
    // Cold server-rendered pages query FalkorDB; allow for that instead of failing on the 30s default.
    test.setTimeout(90_000);
    const problems: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") problems.push(`console: ${msg.text()} @ ${msg.location().url}`);
    });
    page.on("pageerror", (err) => problems.push(`pageerror: ${err.message}`));

    const response = await page.goto(route, { waitUntil: "networkidle" });
    expect(response, `no response for ${route}`).not.toBeNull();
    expect(response!.status(), `status for ${route}`).toBeLessThan(400);

    if (route === "/api/health") {
      expect(await response!.json()).toMatchObject({ ok: true });
    }

    const unexpected = problems.filter((p) => !ALLOWED_CONSOLE_ERRORS.some((a) => p.includes(a)));
    expect(unexpected, `errors on ${route}`).toEqual([]);
  });
}
