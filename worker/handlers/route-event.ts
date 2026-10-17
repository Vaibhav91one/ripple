import type { Job } from "pg-boss";

// Placeholder: the event router lands in a later issue.
export default async function routeEvent(jobs: Job<{ eventId: string; type: string }>[]) {
  for (const j of jobs) console.log("[worker] route-event", j.data.type, j.data.eventId);
}
