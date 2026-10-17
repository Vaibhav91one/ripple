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

export default async function agentCron(jobs: Job<{ agent: string }>[]) {
  const [{ db }, { orgs }, { enqueue }] = await Promise.all([import("../../lib/db"), import("../../lib/db/schema"), import("../../lib/queue")]);
  for (const j of jobs) {
    const ids = await fanOut(j.data.agent, { orgs: () => db().select({ id: orgs.id, isDemo: orgs.isDemo }).from(orgs), enqueue, demoAgents: process.env.RIPPLE_DEMO_AGENTS === "1" });
    console.log("[worker] agent-cron", j.data.agent, `${ids.length} orgs`);
  }
}
