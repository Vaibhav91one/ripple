import { z } from "zod";
import { graphView } from "@/lib/graph/graph-view";
import { bad, handle, params } from "@/lib/server/route";
import { EvidenceKind, GraphView } from "@/lib/graph/view";

/** `kinds` is a comma list of evidence clusters (customers,tickets,deals,contracts); omitted means all. */
const Q = z.object({
  d: z.string().min(1),
  team: z.string().min(1).optional(),
  kinds: z.string().optional().transform((s) => (s ? s.split(",") : [])).pipe(z.array(EvidenceKind)),
});

export function GET(req: Request) {
  const q = params(req, Q);
  if (bad(q)) return q;
  return handle(GraphView, (g, now) => graphView(g, q.d, now, { team: q.team, kinds: q.kinds }));
}
