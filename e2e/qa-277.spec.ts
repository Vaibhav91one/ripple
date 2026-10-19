import { expect, test } from "@playwright/test";

test("Notifications in the sidebar opens the Activity tab", async ({ page }) => {
  await page.goto("/", { waitUntil: "networkidle" }); // idle = hydrated, so the drawer button works
  const menu = page.getByRole("button", { name: "Open menu" });
  if (await menu.isVisible()) {
    await menu.click(); // phone: the sidebar is a drawer
    await expect(menu).toHaveAttribute("aria-expanded", "true");
  }
  await page.getByRole("link", { name: /^Notifications/ }).click();
  await expect(page).toHaveURL(/\/reports\?tab=activity/);
  await expect(page.getByRole("tab", { name: "Activity" })).toHaveAttribute("aria-selected", "true");
});

test("a pending item on the case file opens its approval, not the home page", async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto("/reports/d-1");
  const pending = page.getByRole("link", { name: /Tell|Notify|Create task/ }).filter({ has: page.locator("xpath=ancestor::*[contains(., 'Pending on you')]") }).first();
  test.skip(!(await pending.count()), "no pending approval in this graph");
  await pending.click();
  await expect(page).toHaveURL(/\/reports\/d-1\?.*a=/);
  await expect(page.getByRole("dialog")).toBeVisible();
});

test("skip link is first in the Tab order and lands on main", async ({ page }, info) => {
  test.skip(info.project.name === "mobile", "keyboard-only feature; the 390px project is the same Chromium");
  await page.goto("/help", { waitUntil: "networkidle" }); // "/" autofocuses the Assistant composer; idle = hydrated, so focus is not reset after Tab
  await page.keyboard.press("Tab");
  const skip = page.getByRole("link", { name: "Skip to content" });
  await expect(skip).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/#main$/);
  await expect(page.locator("main#main")).toBeFocused();
});

test("Help answers the basics and does not repeat the sidebar credits", async ({ page }) => {
  await page.goto("/help");
  for (const q of ["What is Ripple?", "What is the demo?", "How do I connect my tools?", "Who can see what?", "Can I run it myself?"]) await expect(page.getByText(q)).toBeVisible();
  await expect(page.getByRole("heading", { name: "Credits" })).toHaveCount(0);
});

test("/ and an unknown case id log no console errors or warnings", async ({ page }) => {
  const logs: string[] = [];
  page.on("console", (m) => ["error", "warning"].includes(m.type()) && logs.push(`${m.type()}: ${m.text()}`));
  page.on("pageerror", (e) => logs.push(e.message));
  await page.goto("/", { waitUntil: "networkidle" });
  await page.goto("/reports/does-not-exist", { waitUntil: "networkidle" });
  await expect(page.getByText("That page or team doesn't exist")).toBeVisible();
  expect(logs).toEqual([]);
});
