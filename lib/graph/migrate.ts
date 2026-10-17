// Versioned graph migrations (the Postgres equivalent is drizzle). Append only, never edit or reorder an applied entry.
// Each applied id is recorded as a (:Migration {id, at}) node in that graph; a Cypher body must itself be safe to re-run.
import { query, type Graph } from "./client";

export const MIGRATIONS: { id: string; cypher: string }[] = [
  {
    // #138 made decisions :Change:Decision; graphs seeded before it only have :Decision.
    id: "001-decision-is-change",
    cypher: "MATCH (d:Decision) WHERE NOT d:Change SET d:Change, d.kind = coalesce(d.kind, 'decision'), d.effective_at = coalesce(d.effective_at, d.decidedAt)",
  },
  // #169 CSV import adds :Software and :AccessGroup nodes; live graphs need their id indexes (ensureSchema may have made them already).
  { id: "002-software-id-index", cypher: "CREATE INDEX FOR (n:Software) ON (n.id)" },
  { id: "003-access-group-id-index", cypher: "CREATE INDEX FOR (n:AccessGroup) ON (n.id)" },
];

/** Apply the migrations this graph has not recorded yet, in order; returns the ids applied now. Idempotent. */
export async function migrateGraph(g: Graph, now = Math.floor(Date.now() / 1000)): Promise<string[]> {
  const done = new Set((await query<{ id: string }>(g, "MATCH (m:Migration) RETURN m.id AS id")).map((r) => r.id));
  const applied: string[] = [];
  for (const m of MIGRATIONS) {
    if (done.has(m.id)) continue;
    try {
      await query(g, m.cypher);
    } catch (e) {
      if (!/already indexed/i.test(String(e))) throw e;
    }
    await query(g, "MERGE (m:Migration {id: $id}) ON CREATE SET m.at = $now", { id: m.id, now });
    applied.push(m.id);
  }
  return applied;
}
