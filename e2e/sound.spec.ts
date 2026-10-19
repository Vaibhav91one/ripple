import { expect, test } from "@playwright/test";

// The sidebar speaker toggle persists across reloads and keeps the Profile checkbox in sync.
test("sound toggle persists across reloads", async ({ page }) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.goto("/profile", { waitUntil: "networkidle" });
  const box = page.getByRole("checkbox", { name: /Interaction sounds/ });
  await expect(box).toBeChecked(); // default on (no reduced-motion hint in headless)
  await page.getByRole("switch", { name: "Interaction sounds" }).click();
  await expect(box).not.toBeChecked();
  await page.reload({ waitUntil: "networkidle" });
  await expect(page.getByRole("checkbox", { name: /Interaction sounds/ })).not.toBeChecked();
  await expect(page.getByRole("switch", { name: "Interaction sounds" })).toHaveAttribute("aria-checked", "false");
});
