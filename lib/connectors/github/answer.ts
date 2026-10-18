// Real answerer + impact lookup for the worker: runAgent over the installation's org graph. Not imported by tests of the pure handlers.
import { and, eq } from "drizzle-orm";
import { runAgent } from "../../agent/loop";
import { pickModel } from "../../llm";
import { graphFor, roQuery, type Graph } from "../../graph/client";
import { prId } from "./map";
import type { Answer, CheckJob, Impact, MentionJob } from "./mention";

export async function orgForInstallation(installation: number): Promise<{ orgId: string; graph: Graph }> {
  const [{ db }, { connectorAccounts, orgs }] = await Promise.all([import("../../db"), import("../../db/schema")]);
  const [row] = await db().select({ orgId: connectorAccounts.orgId, graphName: orgs.graphName }).from(connectorAccounts)
    .innerJoin(orgs, eq(orgs.id, connectorAccounts.orgId)).where(and(eq(connectorAccounts.kind, "github"), eq(connectorAccounts.externalId, String(installation))));
  if (!row) throw new Error(`no org for installation ${installation}`);
  return { orgId: row.orgId, graph: await graphFor(row.graphName) };
}

/** Systems a PR is ABOUT, their owning teams, and a decision in flight that sunsets one of them (or something they depend on). */
export async function prImpact(g: Graph, job: Pick<CheckJob, "repo" | "number">): Promise<Impact> {
  const id = prId(job.repo, job.number);
  const systems = await roQuery<{ id: string; name: string | null }>(g, "MATCH (:PR {id: $id})-[r:ABOUT]->(s:System) WHERE r.valid_to IS NULL RETURN DISTINCT s.id AS id, s.name AS name", { id });
  if (!systems.length) return { systems: [], teams: [] };
  const ids = systems.map((s) => s.id);
  const [teams, dec] = await Promise.all([
    roQuery<{ name: string }>(g, "MATCH (s:System)-[r:OWNED_BY]->(t:Team) WHERE s.id IN $ids AND r.valid_to IS NULL RETURN DISTINCT t.name AS name", { ids }),
    roQuery<{ id: string; title: string }>(g, "MATCH (d:Decision)-[sn:SUNSETS]->(:System)<-[:DEPENDS_ON*0..2]-(x:System) WHERE x.id IN $ids AND sn.valid_to IS NULL RETURN DISTINCT d.id AS id, d.title AS title LIMIT 1", { ids }),
  ]);
  return { systems: systems.map((s) => ({ id: s.id, name: s.name ?? s.id })), teams: teams.map((t) => t.name), decisionId: dec[0]?.id, decisionTitle: dec[0]?.title };
}

/** Ask agent over the org graph. Reads as a viewer with no team, so restricted text never reaches the model or the comment. */
export async function askAgent(g: Graph, job: MentionJob): Promise<Answer> {
  const model = pickModel("agent");
  if (!model) return { text: "No model key is configured on this Ripple server, so I cannot answer questions yet." };
  const question = `On GitHub ${job.repo}#${job.number} ("${job.title}") ${job.author} asked: ${job.text || "What does this touch?"}\n\nThread description: ${job.context}`;
  let text = "";
  const cites: { artifactId: string; quote: string }[] = [];
  for await (const ev of runAgent({ model, question, g, now: Math.floor(Date.now() / 1000), readonly: true, viewer: { teamIds: [] } })) {
    if (ev.type === "text_delta") text += ev.text;
    else if (ev.type === "citation") {
      const n = ev.sources.map((s) => { let i = cites.findIndex((c) => c.artifactId === s.artifactId); if (i < 0) i = cites.push(s) - 1; return i + 1; });
      text += ` [${n.join(", ")}]`;
    }
  }
  const titles = cites.length ? await roQuery<{ id: string; title: string | null }>(g, "MATCH (a:Artifact) WHERE a.id IN $ids RETURN a.id AS id, a.title AS title", { ids: cites.map((c) => c.artifactId) }) : [];
  const title = (id: string) => titles.find((t) => t.id === id)?.title ?? id;
  const foot = cites.map((c, i) => `${i + 1}. **${title(c.artifactId)}**: "${c.quote.replace(/\s+/g, " ")}"`).join("\n");
  const impact = await prImpact(g, job).catch(() => null); // empty unless this number is a synced PR
  return { text: text.trim() + (foot ? `\n\n${foot}` : ""), decisionId: impact?.decisionId };
}
