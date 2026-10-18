import { defineConfig, devices } from "@playwright/test";
import { E2E_EMPTY_GRAPH, E2E_EMPTY_PORT, E2E_GRAPH } from "./e2e/global-setup";

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
    : [
      { command: "pnpm start -p 3201", url: baseURL, reuseExistingServer: true, timeout: 120_000, env: { RIPPLE_GRAPH: E2E_GRAPH } },
      // #274: a local-mode org whose graph starts empty (e2e/empty-org.spec.ts)
      { command: `pnpm start -p ${E2E_EMPTY_PORT}`, url: `http://localhost:${E2E_EMPTY_PORT}/api/health`, reuseExistingServer: true, timeout: 120_000, env: { RIPPLE_GRAPH: E2E_EMPTY_GRAPH, RIPPLE_MODE: "local", RIPPLE_AUTH: "off" } },
    ],
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
