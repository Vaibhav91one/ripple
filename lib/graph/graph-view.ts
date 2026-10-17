// /api/graph orchestration: the ripple plus per-edge evidence (graph-view.cypher), shaped into lanes by view.ts.
import { z } from "zod";
import { roQuery, type Graph } from "./client";
import { load, ripple } from "./queries";
import { buildGraphView, type EdgeMeta, type EvidenceKind, type GraphView } from "./view";

const n = z.coerce.number();
const Meta = z.object({
  from: z.string(), to: z.string(), type: z.string(), validFrom: n.nullable(), src: z.string().nullable(), quote: z.string().nullable(),
});

export async function graphView(g: Graph, decisionId: string, now: number, opts: { team?: string | null; kinds?: EvidenceKind[] } = {}): Promise<GraphView> {
  const r = await ripple(g, decisionId, now); // throws NotFound for an unknown decision
  const c = load("graph-view");
  const meta: EdgeMeta[] = z.array(Meta).parse(await roQuery(g, c.text, { id: decisionId }));
  return buildGraphView({ ...r, cypher: [...r.cypher, c] }, meta, opts);
}
