import type { Job } from "pg-boss";
import type { InboundJob } from "../../lib/connectors/slack/interactive";

/** Slack buttons, shortcuts, slash commands and message events, verified and acked by /api/slack/*. */
export default async function slackInbound(jobs: Job<InboundJob>[]) {
  const [{ handleInbound }, { realDeps }, { safeMessage }] = await Promise.all([
    import("../../lib/connectors/slack/interactive"), import("../../lib/connectors/slack/deps"), import("../../lib/log"),
  ]);
  for (const j of jobs) {
    try {
      await handleInbound(j.data, await realDeps(j.data));
    } catch (e) {
      console.error("[worker] slack-inbound", j.data.kind, safeMessage(e)); // a poisoned interaction must not retry-loop
    }
  }
}
