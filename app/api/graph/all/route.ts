import { z } from "zod";
import { graphAll } from "@/lib/graph/graph-view";
import { bad, handle, params } from "@/lib/server/route";
import { EvidenceKind, GraphAllView } from "@/lib/graph/view";

/** The whole company graph (capped, read-only, redacted). `kind` is a comma list of evidence kinds; `team` keeps its two-hop neighbourhood. */
const Q = z.object({
  team: z.string().min(1).optional(),
  kind: z.string().optional().transform((s) => (s ? s.split(",") : [])).pipe(z.array(EvidenceKind)),
});

export function GET(req: Request) {
  const q = params(req, Q);
  if (bad(q)) return q;
  return handle(GraphAllView, ({ graph, now }) => graphAll(graph, now, { team: q.team, kinds: q.kind }));
}
