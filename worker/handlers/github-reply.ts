import type { Job } from "pg-boss";
import type { GithubJob } from "../../lib/connectors/github/mention";

/** GitHub @mention replies and "Ripple impact" Check Runs, queued by the webhook so it can answer 2xx fast. A failed job is logged, not retried (no duplicate comments). */
export default async function githubReply(jobs: Job<GithubJob>[]) {
  const [{ handleMention, handleCheck }, { askAgent, orgForInstallation, prImpact }, { githubApp }, { githubEnv }, { env }, { safeMessage }] = await Promise.all([
    import("../../lib/connectors/github/mention"), import("../../lib/connectors/github/answer"), import("../../lib/connectors/github/client"),
    import("../../lib/connectors/github/app-creds"), import("../../lib/env"), import("../../lib/log"),
  ]);
  for (const j of jobs) {
    try {
      const app = githubApp(await githubEnv());
      if (!app) throw new Error("GitHub App is not configured");
      const octo = (await app.getInstallationOctokit(j.data.installation)) as never;
      const { graph } = await orgForInstallation(j.data.installation);
      if (j.data.kind === "mention") await handleMention(j.data, octo, (m) => askAgent(graph, m), env().APP_URL);
      else await handleCheck(j.data, octo, (c) => prImpact(graph, c));
    } catch (e) {
      console.error("[worker] github-reply", j.data.kind, safeMessage(e));
    }
  }
}
