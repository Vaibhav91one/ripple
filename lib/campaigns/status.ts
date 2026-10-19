// campaignStatus(changeId): per affected team, how far the change has travelled. computeCampaign (ledger, Slack evidence, tasks) plus
// the graph's own answers for ack, access grants and the campaign item's due date. Topology only: no clause, quote or contract text.
import { roQuery, type Graph } from "../graph/client";
import { computeCampaign } from "../campaign";
import type { Context } from "../server/context";

export type TeamStatus = {
  teamId: string; ownerId: string | null; dueAt: number | null;
  told: boolean; delivered: boolean; clicked: boolean; acked: boolean; discussed: boolean;
  tasks: { done: number; total: number };
  /** No open access request left (and at least one was granted when the plan said access was needed). */
  accessGranted: boolean;
  overdue: boolean;
};
export type CampaignStatus = { changeId: string; title: string; changeDate: number | null; channelId: string | null; teams: TeamStatus[]; done: boolean };

export async function campaignStatus(g: Graph, org: { id: string }, changeId: string, now: number): Promise<CampaignStatus> {
  const c = await computeCampaign({ graph: g, now, org } as Pick<Context, "graph" | "now" | "org">, changeId);
  const [items, reqs] = await Promise.all([
    roQuery<{ teamId: string; dueAt: number | null; accessNeeded: number | null }>(g, "MATCH (:Campaign {decisionId: $id})-[:HAS_ITEM]->(i:CampaignItem) RETURN i.teamId AS teamId, i.dueAt AS dueAt, i.accessNeeded AS accessNeeded", { id: changeId }),
    roQuery<{ teamId: string; open: number; total: number }>(g, "MATCH (a:AccessRequest {decisionId: $id}) RETURN a.teamId AS teamId, sum(CASE WHEN a.status = 'open' THEN 1 ELSE 0 END) AS open, count(a) AS total", { id: changeId }),
  ]);
  const chan = await roQuery<{ ch: string | null }>(g, "MATCH (c:Campaign {decisionId: $id}) RETURN c.channelId AS ch", { id: changeId });
  const teams = c.teams.map((t): TeamStatus => {
    const item = items.find((i) => i.teamId === t.teamId);
    const rq = reqs.find((r) => r.teamId === t.teamId);
    const tasks = { done: t.tasks.filter((k) => k.status === "done").length, total: t.tasks.length };
    const acked = t.acked !== null || t.covered;
    const accessGranted = (rq?.open ?? 0) === 0 && (!item?.accessNeeded || (rq?.total ?? 0) > 0);
    const dueAt = item?.dueAt ?? t.dueAt;
    const complete = acked && tasks.done === tasks.total && accessGranted;
    return { teamId: t.teamId, ownerId: t.ownerId, dueAt, told: t.told !== null, delivered: t.delivered !== null, clicked: t.clicked !== null, acked, discussed: t.discussed.length > 0, tasks, accessGranted, overdue: !!dueAt && dueAt < now && !complete };
  });
  return { changeId, title: c.title, changeDate: c.effectiveAt, channelId: c.channel?.id ?? chan[0]?.ch ?? null, teams, done: teams.every((t) => t.acked && t.tasks.done === t.tasks.total && t.accessGranted) };
}

const day = (t: number | null) => (t ? new Date(t * 1000).toISOString().slice(0, 10) : "no date");
const tick = (b: boolean) => (b ? "yes" : "no");

/** The pinned tracker message. `names` maps team and person ids to display names. */
export function renderTracker(s: CampaignStatus, names: Map<string, string>, slackIds: Map<string, string> = new Map()): string {
  const who = (id: string | null) => (id ? (slackIds.get(id) ? `<@${slackIds.get(id)}>` : (names.get(id) ?? id)) : "no owner");
  const lines = s.teams.map((t) =>
    `- *${names.get(t.teamId) ?? t.teamId}*: owner ${who(t.ownerId)}, due ${day(t.dueAt)}, told ${tick(t.told)}, acked ${tick(t.acked)}, tasks ${t.tasks.done}/${t.tasks.total}, access ${tick(t.accessGranted)}${t.overdue ? ", *OVERDUE*" : ""}`);
  return [`*Tracker: ${s.title}* (change date ${day(s.changeDate)})`, ...lines, s.done ? "Everything is done." : ""].filter(Boolean).join("\n");
}
