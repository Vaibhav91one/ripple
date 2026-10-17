// Graph writes for connector proposals. One writer, used by the sync runner (structured) and the graph_merge executor (approved).
import { query, type Graph } from "../graph/client";
import { detectConflicts } from "../graph/queries";
import { WEIGHTED } from "../graph/schema";
import { GraphProposal } from "./define";

/** Writes that can start or end a sunset-vs-guarantee conflict. */
const CONFLICT_EDGES = new Set(["GUARANTEES", "SUNSETS", "PROMISED", "PARTY_TO"]);

/** Parses first, so a bad label or edge type never reaches the Cypher text. */
export type Applied = { applied: true } | { applied: false; reason: "missing_endpoint"; missing: { label: string; id: string } };

/** An edge whose endpoint node is absent is not written: the result says which one, so callers can fail or count it rather than lose it silently. */
export async function applyProposal(g: Graph, input: unknown, now: number, orgId?: string): Promise<Applied> {
  const p = GraphProposal.parse(input);
  const r = await write(g, p, now);
  // The one place ingest and approved proposals change guarantees or sunsets: re-check conflicts and tell the Advisor about new ones.
  // ponytail: re-checks every decision per matching write; scope it to the touched decisions if bulk syncs get slow.
  if (r.applied && (p.op === "merge_node" ? p.label === "Contract" : CONFLICT_EDGES.has(p.type))) {
    const detected = await detectConflicts(g, now);
    if (orgId) await (await import("../events/conflicts")).emitConflictsFound(orgId, detected);
  }
  return r;
}

async function write(g: Graph, p: ReturnType<typeof GraphProposal.parse>, now: number): Promise<Applied> {
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
  const weight = WEIGHTED.has(p.type) ? ", r.weight = coalesce($props.weight, r.weight, 1)" : ""; // after `+=`, so a proposal may set its own weight
  if (p.op === "merge_edge") await query(g, `${match} MERGE (a)-[r:${p.type}]->(b) SET r += $props, r.valid_from = coalesce(r.valid_from, $now), r.src = $src, r.endedAt = null, r.valid_to = null, r.updatedAt = $now${weight}`, params);
  else await query(g, `${match} MATCH (a)-[r:${p.type}]->(b) WHERE r.endedAt IS NULL SET r.endedAt = $now, r.valid_to = $now`, params);
  return { applied: true };
}
