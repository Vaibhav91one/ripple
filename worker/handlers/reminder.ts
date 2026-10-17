import type { Job } from "pg-boss";
import type { ReminderJob } from "../../lib/notify/reminders";

/** 48h / 96h job: if the person (or their team) still has not acknowledged, emit ack.missing_*; routing sends it. */
export default async function reminder(jobs: Job<ReminderJob>[]) {
  const [{ db }, { orgs }, { eq }, { graphFor }, { loadSnapshot }, { handleReminder }, { emit }] = await Promise.all([
    import("../../lib/db"), import("../../lib/db/schema"), import("drizzle-orm"), import("../../lib/graph/client"),
    import("../../lib/notify/graph-reader"), import("../../lib/notify/reminders"), import("../../lib/events/emit"),
  ]);
  const d = db();
  for (const j of jobs) {
    const [org] = await d.select().from(orgs).where(eq(orgs.id, j.data.orgId));
    const snapshot = await loadSnapshot(await graphFor(org?.graphName ?? j.data.orgId));
    console.log("[worker] reminder", j.data.kind, j.data.changeId, j.data.userId, await handleReminder(j.data, { snapshot, emit: (e) => emit(d, e) }));
  }
}
