// What the /ack/[token] page shows: the brief for the token's team, built from the graph and redacted FOR THAT TEAM (#142).
// The link has no session viewer, so the recipient team is the viewer; a team that cannot be resolved sees every foreign quote redacted.
import { env } from "./env";
import { graphFor, roQuery } from "./graph/client";
import { buildBrief } from "./briefs";
import { ripple } from "./graph/queries";
import { redactForTeam } from "./permissions/redact";
import { DEMO_GRAPH, graphNameFor } from "./server/context";

/** The token's org picks the graph (not the visitor's session); RIPPLE_GRAPH is the test override. */
export const ackGraph = (o: string) => graphFor(env().RIPPLE_GRAPH || (o === DEMO_GRAPH ? DEMO_GRAPH : graphNameFor(o)));

export async function ackBrief(org: string, teamId: string, decisionId: string, now = Math.floor(Date.now() / 1000)) {
  const g = await ackGraph(org);
  const r = await ripple(g, decisionId, now);
  const team = r.nodes.find((n) => n.id === teamId)?.label ?? teamId;
  const brief = await redactForTeam(g, teamId, await buildBrief(teamId, decisionId, { g, now, rippleResult: r, model: null }));
  const titles = new Map((await redactForTeam(g, teamId, await roQuery<{ id: string; title: string }>(
    g, "MATCH (a:Artifact) WHERE a.id IN $ids RETURN a.id AS id, a.title AS title", { ids: brief.claims.flatMap((c) => c.sources.map((s) => s.artifactId)) },
  ))).map((a) => [a.id, a.title]));
  return { brief, team, decision: r.decision.title, title: (id: string) => titles.get(id) ?? id };
}
