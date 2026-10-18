import { defineConfig, devices } from "@playwright/test";
import { E2E_GRAPH } from "./e2e/global-setup";

// E2E_BASE_URL: test a running deployment instead of starting `next start` locally.
const external = process.env.E2E_BASE_URL;
const baseURL = external ?? "http://localhost:3201";
// Locally we use the installed Chrome; CI uses the Playwright-managed Chromium (npx playwright install chromium).
const channel = process.env.CI ? undefined : "chrome";

export default defineConfig({
  testDir: "e2e",
  globalSetup: "./e2e/global-setup.ts",
  fullyParallel: true,
  // FalkorDB is one shared instance; more parallel pages make its health probe time out (503) under load.
  workers: 2,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"]],
  use: { baseURL, trace: "retain-on-failure" },
  // Expects a prior `pnpm build`.
  webServer: external
    ? undefined
    : { command: "pnpm start -p 3201", url: baseURL, reuseExistingServer: true, timeout: 120_000, env: { RIPPLE_GRAPH: E2E_GRAPH } },
  projects: [
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"], channel, viewport: { width: 1440, height: 900 } },
    },
    {
      name: "mobile",
      use: { ...devices["Desktop Chrome"], channel, viewport: { width: 390, height: 844 } },
    },
  ],
});
