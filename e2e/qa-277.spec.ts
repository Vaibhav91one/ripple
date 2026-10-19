import { expect, test } from "@playwright/test";

test("Notifications in the sidebar opens the Activity tab", async ({ page }) => {
  await page.goto("/");
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

test("skip link is first in the Tab order and lands on main", async ({ page }) => {
  await page.goto("/");
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
