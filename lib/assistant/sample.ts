// "Load the sample company" (#274): the Ledgerly demo data, seeded into one org's OWN graph (t_<orgId>). Never the shared demo graph.
// Idempotent (a SampleInfo marker; the seed itself MERGEs on id) and removable: every node the sample created is tagged sample=true.
import { graphFor, query, roQuery } from "../graph/client";
import { migrateGraph } from "../graph/migrate";
import { seed } from "../ingest/seed";

/** Org graphs only: `t_` + org id (lib/server/context graphNameFor). Refuses `demo` and anything else. */
function orgGraph(name: string): string {
  if (!/^t_[a-z0-9_]+$/.test(name)) throw new Error(`sample data goes into an org graph only, not "${name}"`);
  return name;
}

const has = async (name: string, label: string) =>
  Number((await roQuery<{ n: number }>(await graphFor(name), `MATCH (s:${label}) RETURN count(s) AS n`))[0]?.n ?? 0) > 0;

export const sampleLoaded = (graphName: string) => has(orgGraph(graphName), "SampleInfo");

export async function loadSample(graphName: string, now: number): Promise<"loaded" | "present"> {
  const g = await graphFor(orgGraph(graphName));
  if (await has(graphName, "SampleInfo")) return "present";
  const before = (await roQuery<{ id: string }>(g, "MATCH (n) WHERE n.id IS NOT NULL RETURN n.id AS id")).map((r) => r.id);
  const hadSeedInfo = await has(graphName, "SeedInfo");
  // ponytail: a node the org already had under a sample id (e.g. a team "eng") gets the sample's props and is kept on removal
  await seed(graphName);
  await migrateGraph(g);
  await query(g, "MATCH (n) WHERE n.id IS NOT NULL AND NOT n:Migration AND NOT n.id IN $before SET n.sample = true", { before });
  if (!hadSeedInfo) await query(g, "MATCH (s:SeedInfo) DELETE s"); // an org graph never claims the demo seed version
  await query(g, "MERGE (s:SampleInfo {k: 'sample'}) SET s.at = $now", { now });
  return "loaded";
}

/** Deletes every node the sample created (and their edges). The org's own data stays. */
export async function removeSample(graphName: string): Promise<"removed" | "absent"> {
  const g = await graphFor(orgGraph(graphName));
  if (!(await has(graphName, "SampleInfo"))) return "absent";
  await query(g, "MATCH (n) WHERE n.sample = true DETACH DELETE n");
  await query(g, "MATCH (s:SampleInfo) DELETE s");
  return "removed";
}
