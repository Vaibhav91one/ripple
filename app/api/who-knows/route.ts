import { z } from "zod";
import { whoKnows } from "@/lib/graph/queries";
import { bad, handle, params } from "@/lib/server/route";
import { WhoKnowsRow } from "@/lib/schemas";


export function GET(req: Request) {
  const q = params(req, z.object({ system: z.string().min(1) }));
  if (bad(q)) return q;
  return handle(z.array(WhoKnowsRow), async (g) => (await whoKnows(g, q.system)).data);
}
