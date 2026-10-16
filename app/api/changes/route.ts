import { z } from "zod";
import { diff } from "@/lib/graph/queries";
import { bad, handle, params } from "@/lib/server/route";
import { Change } from "@/lib/schemas";


/** `since` is epoch seconds (default 0 = everything). */
export function GET(req: Request) {
  const q = params(req, z.object({ since: z.coerce.number().int().default(0) }));
  if (bad(q)) return q;
  return handle(z.array(Change), async (g) => (await diff(g, q.since)).data);
}
