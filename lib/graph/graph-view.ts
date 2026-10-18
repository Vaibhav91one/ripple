// /api/graph orchestration: the ripple plus per-edge evidence (graph-view.cypher), shaped into lanes by view.ts.
import { z } from "zod";
import { roQuery, type Graph } from "./client";
import { load, ripple } from "./queries";
import { buildAllView, buildGraphView, type EdgeMeta, type EvidenceKind, type GraphView } from "./view";

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

const AllNode = z.object({ id: z.string(), labels: z.array(z.string()), title: z.coerce.string(), conflict: z.boolean() });
const AllLink = z.object({ from: z.string(), to: z.string(), type: z.string() });
export const ALL_CAP = 600;

/** The whole company graph, capped, for /api/graph/all. Read-only (roQuery). */
export async function graphAll(g: Graph, now: number, opts: { team?: string | null; kinds?: EvidenceKind[] } = {}): Promise<GraphView> {
  const nc = load("graph-all"), ec = load("graph-all-edges");
  const rows = z.array(AllNode).parse(await roQuery(g, nc.text, { cap: ALL_CAP }));
  const edges = z.array(AllLink).parse(await roQuery(g, ec.text, { ids: rows.map((r) => r.id) }));
  return { ...buildAllView(rows, edges, { ...opts, cap: ALL_CAP, now }), cypher: [nc, ec] };
}
