// Graph writes for connector proposals. One writer, used by the sync runner (structured) and the graph_merge executor (approved).
import { query, type Graph } from "../graph/client";
import { GraphProposal } from "./define";

/** Parses first, so a bad label or edge type never reaches the Cypher text. */
export type Applied = { applied: true } | { applied: false; reason: "missing_endpoint"; missing: { label: string; id: string } };

/** An edge whose endpoint node is absent is not written: the result says which one, so callers can fail or count it rather than lose it silently. */
export async function applyProposal(g: Graph, input: unknown, now: number): Promise<Applied> {
  const p = GraphProposal.parse(input);
  if (p.op === "merge_node") {
    const extra = p.labels?.length ? ` SET ${p.labels.map((l) => `n:${l}`).join(", ")}` : ""; // labels are enum-validated
    await query(g, `MERGE (n:${p.label} {id: $id}) SET n += $props, n.src = $src, n.updatedAt = $now${extra}`, { id: p.id, props: p.props, src: p.src, now });
    return { applied: true };
  }
  const match = `MATCH (a:${p.from.label} {id: $a}), (b:${p.to.label} {id: $b})`;
  const params = { a: p.from.id, b: p.to.id, props: p.props, src: p.src, now };
  const [have] = await query<{ na: number; nb: number }>(g, `OPTIONAL MATCH (a:${p.from.label} {id: $a}) OPTIONAL MATCH (b:${p.to.label} {id: $b}) RETURN count(a) AS na, count(b) AS nb`, { a: p.from.id, b: p.to.id });
  if (!have.na) return { applied: false, reason: "missing_endpoint", missing: p.from };
  if (!have.nb) return { applied: false, reason: "missing_endpoint", missing: p.to };
  if (p.op === "merge_edge") await query(g, `${match} MERGE (a)-[r:${p.type}]->(b) SET r += $props, r.valid_from = coalesce(r.valid_from, $now), r.src = $src, r.endedAt = null, r.valid_to = null, r.updatedAt = $now`, params);
  else await query(g, `${match} MATCH (a)-[r:${p.type}]->(b) WHERE r.endedAt IS NULL SET r.endedAt = $now, r.valid_to = $now`, params);
  return { applied: true };
}
