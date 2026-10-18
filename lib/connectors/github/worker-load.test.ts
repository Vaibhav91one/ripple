import { execFileSync } from "node:child_process";
import { expect, it } from "vitest";

// The worker is `tsx worker/index.ts`: our .ts files load as CommonJS there, and @octokit/* are ESM-only (exports have only an "import" condition).
// A static import made the github-reply handler die with ERR_PACKAGE_PATH_NOT_EXPORTED, so @mention replies silently never ran (production, 2026-10-18).
it("the GitHub client and answerer load under the worker's runtime (tsx, CommonJS, react-server)", () => {
  const script = `Promise.all([import("./lib/connectors/github/answer"), import("./lib/connectors/github/client")]).then(async ([, c]) => {
    const app = await c.githubApp({ GITHUB_APP_ID: "1", GITHUB_APP_PRIVATE_KEY: "k", GITHUB_APP_WEBHOOK_SECRET: "s" });
    console.log("loaded", typeof app.getInstallationOctokit, await c.verifySignature("s", "{}", "sha256=00"));
  })`;
  const out = execFileSync("node_modules/.bin/tsx", ["--conditions=react-server", "-e", script], { encoding: "utf8", env: { ...process.env, NODE_ENV: "production" } });
  expect(out.trim()).toBe("loaded function false");
}, 60_000);
