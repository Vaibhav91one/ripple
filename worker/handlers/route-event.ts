import type { Job } from "pg-boss";

/** Load the event, snapshot the graph and prefs, route(), store notifications (deduped) and queue deliveries. */
export default async function routeEvent(jobs: Job<{ eventId: string; type: string; orgId: string }>[]) {
  // lazy: lib/db is "server-only"
  const [{ db }, { events, orgs }, { eq }, { graphFor }, { RippleEvent }, { loadGraphReader }, { loadPrefsReader }, { routeAndStore }, { enqueue }] = await Promise.all([
    import("../../lib/db"), import("../../lib/db/schema"), import("drizzle-orm"), import("../../lib/graph/client"),
    import("../../lib/events/types"), import("../../lib/notify/graph-reader"), import("../../lib/notify/prefs"),
    import("../../lib/notify/deliver"), import("../../lib/queue"),
  ]);
  const d = db();
  for (const j of jobs) {
    const [row] = await d.select().from(events).where(eq(events.id, j.data.eventId));
    if (!row) { console.warn("[worker] route-event: event not found", j.data.eventId); continue; }
    if (row.type === "slack.inbound") continue; // queued on slack-inbound by the ingest route; nothing to route
    const event = RippleEvent.parse({ type: row.type, orgId: row.orgId, subject: { kind: row.subjectKind, id: row.subjectId }, payload: row.payload, dedupeKey: row.dedupeKey });
    const [org] = await d.select().from(orgs).where(eq(orgs.id, row.orgId));
    const [{ reader }, prefs] = await Promise.all([loadGraphReader(await graphFor(org?.graphName ?? row.orgId)), loadPrefsReader(row.orgId, d)]);
    const { stored } = await routeAndStore(d, event, row.id, { graph: reader, prefs, now: Math.floor(Date.now() / 1000), enqueue });
    console.log("[worker] route-event", event.type, row.id, `stored ${stored}`);
  }
}
