import type { Job } from "pg-boss";

/** Sync one connector account. A throw makes pg-boss retry, and the retry resumes at the saved cursor. */
export default async function syncJob(jobs: Job<{ accountId: string }>[]) {
  const { runSync } = await import("../../lib/connectors/sync"); // lazy: lib/db is "server-only"
  for (const j of jobs) console.log("[worker] sync", j.data.accountId, await runSync(j.data.accountId));
}
