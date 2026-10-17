import type { Job } from "pg-boss";

export default async function noop(jobs: Job[]) {
  for (const j of jobs) console.log("[worker] noop", j.id);
}
