// Real answerer + impact lookup for the worker: runAgent over the installation's org graph. Not imported by tests of the pure handlers.
import { and, eq } from "drizzle-orm";
import { runAgent } from "../../agent/loop";
import { pickModel } from "../../llm";
import { graphFor, roQuery, type Graph } from "../../graph/client";
import { prId } from "./map";
import { matchPath } from "./codeowners";
import { impactSummary, type Answer, type CheckJob, type Impact, type MentionJob } from "./mention";
import type { Octo } from "./sync";
import { changedPaths } from "./webhook";

export async function orgForInstallation(installation: number): Promise<{ orgId: string; graph: Graph }> {
  const [{ db }, { connectorAccounts, orgs }] = await Promise.all([import("../../db"), import("../../db/schema")]);
  const [row] = await db().select({ orgId: connectorAccounts.orgId, graphName: orgs.graphName }).from(connectorAccounts)
    .innerJoin(orgs, eq(orgs.id, connectorAccounts.orgId)).where(and(eq(connectorAccounts.kind, "github"), eq(connectorAccounts.externalId, String(installation))));
  if (!row) throw new Error(`no org for installation ${installation}`);
  return { orgId: row.orgId, graph: await graphFor(row.graphName) };
}

/** Owning teams and the decision in flight for a set of systems. */
async function impactFor(g: Graph, systems: { id: string; name: string | null }[], scope?: { repo: string; decision: boolean }): Promise<Impact> {
  if (!systems.length) return { systems: [], teams: [] };
  const ids = systems.map((s) => s.id);
  const [teams, dec] = await Promise.all([
    roQuery<{ name: string }>(g, "MATCH (s:System)-[r:OWNED_BY]->(t:Team) WHERE s.id IN $ids AND r.valid_to IS NULL RETURN DISTINCT t.name AS name", { ids }),
    // public repo: a decision only counts when it sunsets one of this repo's own systems, and the Check Run shows none at all
    scope && !scope.decision ? Promise.resolve([] as { id: string; title: string }[])
      : roQuery<{ id: string; title: string }>(g, `MATCH (d:Decision)-[sn:SUNSETS]->(t:System)<-[:DEPENDS_ON*0..2]-(x:System) WHERE x.id IN $ids AND sn.valid_to IS NULL${scope ? " AND (t.id = $repo OR t.id STARTS WITH $paths)" : ""} RETURN DISTINCT d.id AS id, d.title AS title LIMIT 1`,
        { ids, repo: `gh:${scope?.repo}`, paths: `gh:${scope?.repo}:` }),
  ]);
  return { systems: systems.map((s) => ({ id: s.id, name: s.name ?? s.id })), teams: teams.map((t) => t.name), decisionId: dec[0]?.id, decisionTitle: dec[0]?.title };
}

/** Systems a synced PR is ABOUT. */
export async function prImpact(g: Graph, job: Pick<CheckJob, "repo" | "number">): Promise<Impact> {
  return impactFor(g, await roQuery<{ id: string; name: string | null }>(g, "MATCH (:PR {id: $id})-[r:ABOUT]->(s:System) WHERE r.valid_to IS NULL RETURN DISTINCT s.id AS id, s.name AS name", { id: prId(job.repo, job.number) }));
}

const repoSystems = (g: Graph, repo: string) =>
  roQuery<{ id: string; name: string | null; path: string | null }>(g, "MATCH (s:System) WHERE s.id = $repo OR s.id STARTS WITH $paths RETURN s.id AS id, s.name AS name, s.path AS path", { repo: `gh:${repo}`, paths: `gh:${repo}:` });

/** Impact of a PR that may not be synced yet: its changed file paths (list files API) matched against the repo's CODEOWNERS path systems. */
export async function pathImpact(g: Graph, octo: Octo, job: Pick<CheckJob, "repo" | "number" | "publicRepo">): Promise<Impact> {
  const [files, systems] = await Promise.all([changedPaths(octo, job.repo, job.number), repoSystems(g, job.repo)]);
  return impactFor(g, systems.filter((s) => s.id === `gh:${job.repo}` || (s.path && files.some((f) => matchPath(s.path!, f)))), job.publicRepo ? { repo: job.repo, decision: false } : undefined);
}

/** Public repo answer: only this repo's systems, owners and the change touching them. No agent, so no org-wide customers, contracts or deals. */
export async function repoFacts(g: Graph, job: Pick<MentionJob, "repo">): Promise<Answer> {
  const i = await impactFor(g, await repoSystems(g, job.repo), { repo: job.repo, decision: true });
  const lines = [`Here is what Ripple knows about \`${job.repo}\`:`, impactSummary(i), "This repository is public, so Ripple only shares repository-level facts here."];
  return { text: lines.join("\n\n"), decisionId: i.decisionId };
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
