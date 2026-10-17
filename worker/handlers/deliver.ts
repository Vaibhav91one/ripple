import type { Job } from "pg-boss";

/** Collect every pending notification of the batch key into one message per channel and send it. */
export default async function deliver(jobs: Job<{ orgId: string; batchKey: string }>[]) {
  const [{ db }, { orgs }, { eq }, { graphFor }, { loadGraphReader }, { deliverBatch, defaultAdapter }] = await Promise.all([
    import("../../lib/db"), import("../../lib/db/schema"), import("drizzle-orm"), import("../../lib/graph/client"),
    import("../../lib/notify/graph-reader"), import("../../lib/notify/deliver"),
  ]);
  const d = db();
  for (const j of jobs) {
    const [org] = await d.select().from(orgs).where(eq(orgs.id, j.data.orgId));
    const { emailOf } = await loadGraphReader(await graphFor(org?.graphName ?? j.data.orgId));
    const out = await deliverBatch(d, j.data, {
      adapter: defaultAdapter, person: (id) => ({ id, email: emailOf(id) }), now: () => Math.floor(Date.now() / 1000),
    });
    console.log("[worker] deliver", j.data.batchKey, out.map((o) => `${o.channel}:${o.result.status}`).join(",") || "nothing pending");
  }
}
