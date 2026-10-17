import type { Job } from "pg-boss";

type Deps = {
  /** All orgs; the demo is filtered here. */
  orgs: () => Promise<{ id: string; isDemo: boolean }[]>;
  enqueue: (name: "agent", data: object, opts?: object) => Promise<unknown>;
  /** RIPPLE_DEMO_AGENTS=1: the demo org runs scheduled agents too. */
  demoAgents: boolean;
};

/** The scheduled tick for one agent -> one `agent` job per enabled org (every org except the demo). Call it directly in tests. */
export async function fanOut(agent: string, d: Deps): Promise<string[]> {
  const ids = (await d.orgs()).filter((o) => !o.isDemo || d.demoAgents).map((o) => o.id);
  for (const orgId of ids) await d.enqueue("agent", { orgId, agent, trigger: "cron", input: { reason: "cron", decisionId: null, contractId: null } });
  return ids;
}

type Layer = import("../../lib/notify/prefs").Layer;
type DigestDeps = {
  orgs: () => Promise<{ id: string; isDemo: boolean; graphName: string }[]>;
  /** People in the org's graph, and their saved prefs (rows carry personId) plus the org default. */
  people: (org: { id: string; graphName: string }) => Promise<{ id: string; teamId: string | null }[]>;
  prefs: (orgId: string) => Promise<{ rows: (Layer & { personId: string | null })[]; org: Layer | null }>;
  enqueue: (name: "agent", data: object, opts?: object) => Promise<unknown>;
  demoAgents: boolean;
  /** Epoch seconds. */
  now: number;
};

/** The hourly digest tick: one `agent` job per person whose local time is their digest day, 08:00-08:59, and who has not turned the digest off. */
export async function digestFanOut(d: DigestDeps): Promise<string[]> {
  const { digestDue } = await import("../../lib/notify/prefs");
  const sent: string[] = [];
  for (const org of (await d.orgs()).filter((o) => !o.isDemo || d.demoAgents)) {
    const [people, prefs] = await Promise.all([d.people(org), d.prefs(org.id)]);
    for (const p of people) {
      const weekStart = digestDue(d.now, prefs.rows.find((r) => r.personId === p.id), prefs.org);
      if (!weekStart) continue;
      await d.enqueue("agent", { orgId: org.id, agent: "digest", trigger: "cron", input: { personId: p.id, teamId: p.teamId, weekStart } });
      sent.push(`${org.id}:${p.id}`);
    }
  }
  return sent;
}

export default async function agentCron(jobs: Job<{ agent: string }>[]) {
  const [{ db }, { orgs, preferences }, { enqueue }] = await Promise.all([import("../../lib/db"), import("../../lib/db/schema"), import("../../lib/queue")]);
  for (const j of jobs) {
    if (j.data.agent === "digest") {
      const [{ eq }, { graphFor }, { loadSnapshot }, { loadOrgDefault }] = await Promise.all([import("drizzle-orm"), import("../../lib/graph/client"), import("../../lib/notify/graph-reader"), import("../../lib/notify/prefs")]);
      const sent = await digestFanOut({
        orgs: () => db().select({ id: orgs.id, isDemo: orgs.isDemo, graphName: orgs.graphName }).from(orgs),
        people: async (o) => (await loadSnapshot(await graphFor(o.graphName))).people,
        prefs: async (orgId) => ({ rows: await db().select().from(preferences).where(eq(preferences.orgId, orgId)), org: await loadOrgDefault(orgId) }),
        enqueue, demoAgents: process.env.RIPPLE_DEMO_AGENTS === "1", now: Math.floor(Date.now() / 1000),
      });
      if (sent.length) console.log("[worker] agent-cron digest", sent.length, "people");
      continue;
    }
    const ids = await fanOut(j.data.agent, { orgs: () => db().select({ id: orgs.id, isDemo: orgs.isDemo }).from(orgs), enqueue, demoAgents: process.env.RIPPLE_DEMO_AGENTS === "1" });
    console.log("[worker] agent-cron", j.data.agent, `${ids.length} orgs`);
  }
}
