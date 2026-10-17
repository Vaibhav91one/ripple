import type { Job } from "pg-boss";

/** Collect every pending notification of the batch key into one message per channel and send it. */
export default async function deliver(jobs: Job<{ orgId: string; batchKey: string }>[]) {
  const [{ db }, { orgs }, { eq }, { graphFor }, { loadGraphReader }, { deliverBatch, composeAdapter }, { messageBuilder }, { loadSlackAdapter }, { env }, { scheduleForSent }, { enqueue }] = await Promise.all([
    import("../../lib/db"), import("../../lib/db/schema"), import("drizzle-orm"), import("../../lib/graph/client"),
    import("../../lib/notify/graph-reader"), import("../../lib/notify/deliver"), import("../../lib/notify/message"), import("../../lib/notify/channels/slack"), import("../../lib/env"),
    import("../../lib/notify/reminders"), import("../../lib/queue"),
  ]);
  const d = db();
  for (const j of jobs) {
    const [org] = await d.select().from(orgs).where(eq(orgs.id, j.data.orgId));
    const g = await graphFor(org?.graphName ?? j.data.orgId);
    const { emailOf, teamOf } = await loadGraphReader(g);
    const now = () => Math.floor(Date.now() / 1000);
    const out = await deliverBatch(d, j.data, {
      adapter: composeAdapter(await loadSlackAdapter(j.data.orgId, teamOf)), person: (id) => ({ id, email: emailOf(id) }), now,
      build: await messageBuilder(g, { baseUrl: env().APP_URL, now }),
    });
    await scheduleForSent(d, out, { enqueue, now: Math.floor(Date.now() / 1000) }); // a sent brief starts its 48h/96h clock
    console.log("[worker] deliver", j.data.batchKey, out.map((o) => `${o.channel}:${o.result.status}`).join(",") || "nothing pending");
  }
}
