// What an org's own graph holds, for the Assistant home (#274): onboarding when it is (nearly) empty, starter chips from its data otherwise.
// Topology only (change titles, system names, a conflict count): every viewer may see it, nothing here is redacted text.
import { roQuery, type Graph } from "../graph/client";
import type { HomeFacts } from "./smalltalk";

export type OrgHome = HomeFacts & { nodes: number; sample: boolean };
/** Below this many nodes the org still counts as empty: a few synced repos are not a company brain yet. */
export const EMPTY_BELOW = 20;

export async function orgHome(g: Graph): Promise<OrgHome> {
  const [n, changes, systems, conflicts, sample] = await Promise.all([
    roQuery<{ n: number }>(g, "MATCH (n) WHERE NOT n:Migration AND NOT n:SeedInfo AND NOT n:SampleInfo RETURN count(n) AS n"),
    roQuery<{ id: string; title: string }>(g, "MATCH (d:Decision) WHERE d.title IS NOT NULL RETURN d.id AS id, d.title AS title ORDER BY coalesce(d.decidedAt, d.effective_at, 0) DESC LIMIT 2"),
    // repos first (gh:*), then any named system
    roQuery<{ id: string; name: string }>(g, "MATCH (s:System) WHERE s.name IS NOT NULL RETURN s.id AS id, s.name AS name ORDER BY CASE WHEN s.id STARTS WITH 'gh:' THEN 0 ELSE 1 END, s.name LIMIT 2"),
    roQuery<{ n: number }>(g, "MATCH (c:Conflict) RETURN count(c) AS n"),
    roQuery<{ n: number }>(g, "MATCH (s:SampleInfo) RETURN count(s) AS n"),
  ]);
  return { nodes: Number(n[0]?.n ?? 0), changes, systems, conflicts: Number(conflicts[0]?.n ?? 0), sample: Number(sample[0]?.n ?? 0) > 0 };
}
