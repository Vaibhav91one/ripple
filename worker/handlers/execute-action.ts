import type { Job } from "pg-boss";

/** Runs an approved action once; a second job for the same action is skipped by the status check. */
export default async function executeActionJob(jobs: Job<{ id: string }>[]) {
  const { executeAction } = await import("../../lib/actions/execute"); // lazy: lib/db is "server-only"
  for (const j of jobs) console.log("[worker] execute-action", j.data.id, await executeAction(j.data.id));
}
