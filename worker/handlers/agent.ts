import type { Job } from "pg-boss";

export type AgentJob = { orgId: string; agent: string; input?: unknown; trigger?: string; runId?: string };

/** Runs a queued `agent` job through runBackground against the org's graph. A failed run is logged in agent_run, not retried. */
export default async function agent(jobs: Job<AgentJob>[]) {
  // lazy: the runtime pulls in lib/db ("server-only"), which the worker only needs once a job arrives
  const [{ runBackground }, { db }, { orgs }, { graphFor }, { eq }, { agent: findAgent }] = await Promise.all([
    import("../../lib/agent/runtime"), import("../../lib/db"), import("../../lib/db/schema"), import("../../lib/graph/client"), import("drizzle-orm"), import("../../lib/agent/registry"),
  ]);
  for (const j of jobs) {
    const [org] = await db().select().from(orgs).where(eq(orgs.id, j.data.orgId));
    if (!org) { console.error("[worker] agent: unknown org", j.data.orgId); continue; }
    // An agent reads as the team it serves: Contract Sentinel as Legal (clauses are Legal-only), Impact Analyst as the change owner (summaries, no restricted text).
    const team = findAgent(j.data.agent)?.team;
    // The Digest reads as the person it is for: their team's rights, nobody else's.
    const digestIn = j.data.agent === "digest" ? (j.data.input as { personId: string; teamId: string | null; weekStart: string }) : undefined;
    const viewer = digestIn ? { kind: "agent", id: "digest", teamIds: digestIn.teamId ? [digestIn.teamId] : [] }
      : team === "change-owner" ? { kind: "agent", id: j.data.agent, role: "change_owner" } : { kind: "agent", id: j.data.agent, teamIds: team && team !== "everyone" ? [team] : [] };
    const r = await runBackground(j.data.agent, j.data.input ?? {}, {
      g: await graphFor(org.graphName), now: Math.floor(Date.now() / 1000), org: { id: org.id }, viewer,
      trigger: j.data.trigger ?? "queue", runId: j.data.runId,
    });
    const decisionId = (j.data.input as { decisionId?: string } | undefined)?.decisionId;
    if (j.data.agent === "impact" && r.status === "done" && decisionId) {
      const { emit } = await import("../../lib/events/emit");
      await emit(db(), { type: "impact.ready", orgId: org.id, subject: { kind: "change", id: decisionId }, payload: { changeId: decisionId, runId: r.runId }, dedupeKey: `impact.ready:${r.runId}` });
    }
    if (digestIn && r.status === "done") { // low urgency, through the notification engine; one per person per week
      const { emit } = await import("../../lib/events/emit");
      const summary = (r.output as { summary?: string } | undefined)?.summary;
      await emit(db(), { type: "digest.weekly", orgId: org.id, subject: { kind: "digest", id: r.runId }, payload: { weekStart: digestIn.weekStart, personId: digestIn.personId, ...(summary && { summary }) }, dedupeKey: `digest.weekly:${digestIn.weekStart}:${digestIn.personId}` });
    }
    console.log("[worker] agent", j.data.agent, r.status, `${r.tokens} tokens`);
  }
}
