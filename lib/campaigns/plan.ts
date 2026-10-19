// Comms Planner's arithmetic: one campaign per affected team from the impact report. Deterministic, so the model never invents an owner or a date.
import { z } from "zod";
import { roQuery, type Graph } from "../graph/client";
import { ripple } from "../graph/queries";

const DAY = 86400;
/** Days before the change date by team type. ponytail: keyed by team id; a Team.type property would replace this. */
export const LEAD_DAYS: Record<string, number> = { legal: 30, security: 21, finance: 21, devrel: 14, sales: 14, support: 14, product: 10, data: 10, eng: 7 };
const DEFAULT_LEAD_DAYS = 7;
export const LEAD = /lead|manager|head|director|counsel|chief|cto|coo|ceo/i; // same rule as create-tasks.cypher

export const CampaignPlan = z.object({
  id: z.string().min(1),
  decisionId: z.string().min(1),
  changeDate: z.number().int().nullable(),
  /** Why a shared channel exists: 2+ teams, a conflict, or both. null = no channel. */
  channel: z.object({ name: z.string().min(1), reason: z.enum(["teams", "conflict", "both"]) }).nullable(),
  /** The change owner (approves the plan); invited to the channel. */
  changeOwner: z.string().nullable(),
  teams: z.array(z.object({
    teamId: z.string().min(1),
    ownerId: z.string().nullable(),
    dueAt: z.number().int(),
    briefNeeded: z.boolean(),
    /** People still missing software or an access group (from the Access Planner's gap). */
    accessNeeded: z.number().int().min(0),
    tasks: z.array(z.object({ id: z.string().min(1), title: z.string().min(1) })),
  })).min(1),
});
export type CampaignPlan = z.infer<typeof CampaignPlan>;

export const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60).replace(/-+$/, "") || "change";

/** Plan the campaign for a change. `missing` = teamId -> people lacking required access (from access_gap). Null when the change is unknown. */
export async function buildPlan(g: Graph, decisionId: string, now: number, missing: Map<string, number> = new Map()): Promise<CampaignPlan | null> {
  const r = await ripple(g, decisionId, now).catch(() => null);
  if (!r?.teams.length) return null;
  const [people, meta] = await Promise.all([
    roQuery<{ id: string; title: string | null; teamId: string | null }>(g, "MATCH (p:Person) RETURN p.id AS id, p.title AS title, p.teamId AS teamId ORDER BY p.id"),
    roQuery<{ owner: string | null; at: number | null; on: number | null }>(g,
      `MATCH (c:Change {id: $id}) OPTIONAL MATCH (c)-[s:SUNSETS]->(:System) WHERE s.valid_to IS NULL OPTIONAL MATCH (a:Artifact {id: s.src}) OPTIONAL MATCH (p:Person {id: a.author})
       WITH c, head(collect(DISTINCT p.id)) AS au, head(collect(s.on)) AS on RETURN coalesce(c.owner, au) AS owner, c.effective_at AS at, on`, { id: decisionId }),
  ]);
  const changeDate = meta[0]?.on ?? meta[0]?.at ?? null;
  const teams = [...r.teams].sort((a, b) => a.teamId.localeCompare(b.teamId)).map((t) => {
    const owner = people.filter((p) => p.teamId === t.teamId).sort((a, b) => Number(LEAD.test(b.title ?? "")) - Number(LEAD.test(a.title ?? "")))[0];
    // before the change by the team's lead time, but never in the past (then tomorrow) and never after the change itself
    const wanted = (changeDate ?? now + 30 * DAY) - (LEAD_DAYS[t.teamId] ?? DEFAULT_LEAD_DAYS) * DAY;
    const dueAt = Math.min(Math.max(wanted, now + DAY), changeDate ?? Infinity);
    const briefNeeded = r.gap.includes(t.teamId);
    const accessNeeded = missing.get(t.teamId) ?? 0;
    const tasks = [
      ...(briefNeeded ? [{ id: `task-${decisionId}-${t.teamId}`, title: `Review: ${r.decision.title}` }] : []),
      ...(accessNeeded ? [{ id: `task-${decisionId}-${t.teamId}-access`, title: `Get access for ${accessNeeded} ${accessNeeded === 1 ? "person" : "people"}: ${r.decision.title}` }] : []),
    ];
    return { teamId: t.teamId, ownerId: owner?.id ?? null, dueAt, briefNeeded, accessNeeded, tasks };
  });
  const many = r.teams.length >= 2;
  const conflict = r.conflicts.length > 0;
  return {
    id: `camp-${decisionId}`, decisionId, changeDate, changeOwner: meta[0]?.owner ?? null, teams,
    channel: many || conflict ? { name: `chg-${slugify(r.decision.title)}`, reason: many && conflict ? "both" : many ? "teams" : "conflict" } : null,
  };
}
