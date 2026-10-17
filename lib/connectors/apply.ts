// Graph writes for connector proposals. One writer, used by the sync runner (structured) and the graph_merge executor (approved).
import { query, type Graph } from "../graph/client";
import { GraphProposal } from "./define";

/** Parses first, so a bad label or edge type never reaches the Cypher text. */
export async function applyProposal(g: Graph, input: unknown, now: number): Promise<void> {
  const p = GraphProposal.parse(input);
  if (p.op === "merge_node") {
    await query(g, `MERGE (n:${p.label} {id: $id}) SET n += $props, n.src = $src, n.updatedAt = $now`, { id: p.id, props: p.props, src: p.src, now });
    return;
  }
  const match = `MATCH (a:${p.from.label} {id: $a}), (b:${p.to.label} {id: $b})`;
  const params = { a: p.from.id, b: p.to.id, props: p.props, src: p.src, now };
  if (p.op === "merge_edge") await query(g, `${match} MERGE (a)-[r:${p.type}]->(b) SET r += $props, r.valid_from = coalesce(r.valid_from, $now), r.src = $src, r.endedAt = null, r.updatedAt = $now`, params);
  else await query(g, `${match} MATCH (a)-[r:${p.type}]->(b) WHERE r.endedAt IS NULL SET r.endedAt = $now`, params);
}
