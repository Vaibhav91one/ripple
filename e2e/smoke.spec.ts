import { expect, test } from "@playwright/test";
import { STARTER_PROMPTS } from "../lib/assistant/prompts";
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

// Assistant (#237): a starter prompt is served from the cache, so this needs no LLM key.
test("the Assistant answers a starter prompt with sources and an inline card", async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto("/", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: STARTER_PROMPTS[3] }).click();
  await expect(page.getByText(/Sources \(\d+\)/)).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("region", { name: "Contract conflict" })).toBeVisible();
  await expect(page.getByText("Cypher used · 1 query")).toBeVisible();
});

// #268: small talk is answered without a model, so it needs no LLM key either.
test("saying hi gets a friendly reply and chips, with no warning", async ({ page }) => {
  await page.goto("/", { waitUntil: "networkidle" });
  const box = page.getByRole("combobox").first();
  await box.fill("hi");
  await box.press("Enter");
  await expect(page.getByText(/I'm Ripple|Good to see you|Where shall we start/)).toBeVisible({ timeout: 15_000 });
  const chips = page.getByRole("list", { name: "Suggestions" });
  await expect(chips.getByRole("button", { name: "Any contract conflicts?" })).toBeVisible();
  await expect(chips.getByRole("button", { name: "Show the graph" })).toBeVisible();
  await expect(page.getByText(/unverified|decision id|Not in the graph|Cypher used/i)).toHaveCount(0);
});

test("?agent= preselects the agent and the old ?ask=1 drawer lands on the Assistant", async ({ page }) => {
  await page.goto("/?agent=contract", { waitUntil: "networkidle" });
  await expect(page.getByRole("button", { name: "Stop asking Contract Sentinel" })).toBeVisible();
  await page.goto("/reports?ask=1");
  await page.waitForURL((u) => u.pathname === "/" && !u.search.includes("ask"));
});

test("New chat mid-stream drops the running answer instead of writing into the new view", async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto("/", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: STARTER_PROMPTS[1] }).click();
  await expect(page.getByText(STARTER_PROMPTS[1]).first()).toBeVisible();
  await page.getByRole("button", { name: "New chat" }).locator("visible=true").first().click();
  await page.waitForTimeout(2500);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByText(/Sources \(\d+\)/)).toHaveCount(0);
});

// Agents gallery (#235): ?team= filters the cards, search narrows them, the switch is read-only without an admin.
test("/agents filters by team and search", async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto("/agents?team=legal", { waitUntil: "networkidle" });
  await expect(page.getByRole("button", { name: "Contract Sentinel" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Impact Analyst" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Legal", pressed: true })).toBeVisible();
  await page.getByRole("button", { name: "All", exact: true }).click();
  await page.getByRole("searchbox", { name: /search agents/i }).fill("tickets");
  await expect(page.getByRole("button", { name: "Support Desk" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Contract Sentinel" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Chat with this agent" })).toHaveAttribute("href", "/?agent=support");
});


// #267: the ⌘K command menu over the whole company brain.
test("⌘K finds the v1 change and Enter opens its case file; / opens it and Escape closes it", async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto("/reports", { waitUntil: "networkidle" });
  await page.keyboard.press("ControlOrMeta+k");
  const box = page.getByRole("combobox", { name: "Search Ripple" });
  await expect(box).toBeFocused();
  await box.fill("v1");
  await expect(page.getByRole("option", { name: /Sunset API v1 on Jan 31/ })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("option").first()).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/reports\/d-\d+$/);
  await expect(page.getByRole("dialog")).toHaveCount(0);

  await page.locator("body").click({ position: { x: 5, y: 5 } }).catch(() => {});
  await page.keyboard.press("/");
  await expect(box).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(box).toHaveCount(0);
});

test("the Ask Ripple fallback hands the question to the Assistant", async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto("/reports", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Search", exact: true }).filter({ visible: true }).first().click();
  await page.getByRole("combobox", { name: "Search Ripple" }).fill("hi there");
  await page.getByRole("option", { name: /Ask Ripple: hi there/ }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByText("hi there").first()).toBeVisible({ timeout: 30_000 });
});
