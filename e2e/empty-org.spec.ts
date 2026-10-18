import { expect, test } from "@playwright/test";
import { STARTER_PROMPTS } from "../lib/assistant/prompts";
import { E2E_EMPTY_PORT } from "./global-setup";

// #274: a local-mode org whose graph starts empty. Onboarding shows, the sample loads into this org's own graph, then a starter answers.
test.use({ baseURL: process.env.E2E_EMPTY_URL ?? `http://localhost:${E2E_EMPTY_PORT}` });
test.describe.configure({ mode: "serial" });
test.skip(!!process.env.E2E_BASE_URL && !process.env.E2E_EMPTY_URL, "needs the empty local-mode server");

test("an empty org sees onboarding, loads the sample, then a starter question answers", async ({ page, request }) => {
  test.setTimeout(120_000);
  await request.delete("/api/assistant/sample"); // the other viewport's run may have loaded it
  await page.goto("/", { waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { name: "Your company brain is empty" })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("link", { name: /Connect GitHub/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Connect Slack/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Import a CSV/ })).toBeVisible();
  await expect(page.getByRole("button", { name: STARTER_PROMPTS[0] })).toHaveCount(0); // no demo chips for an empty org

  await page.getByRole("button", { name: "Load the sample company" }).click();
  await expect(page.getByText("You are looking at the sample company, Ledgerly.")).toBeVisible({ timeout: 60_000 });
  await expect(page.getByRole("heading", { name: "Your company brain is empty" })).toHaveCount(0);
  await page.getByRole("button", { name: STARTER_PROMPTS[3] }).click();
  await expect(page.getByText(/Northwind Capital and Halden Bank/)).toBeVisible({ timeout: 30_000 });
});
