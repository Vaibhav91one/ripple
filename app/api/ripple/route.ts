import { z } from "zod";
import { ripple } from "@/lib/graph/queries";
import { bad, handle, params } from "@/lib/server/route";
import { RippleResult } from "@/lib/schemas";


export function GET(req: Request) {
  const q = params(req, z.object({ d: z.string().min(1), depth: z.coerce.number().int().min(1).max(4).default(3) }));
  if (bad(q)) return q;
  return handle(RippleResult, (g, now) => ripple(g, q.d, now, q.depth));
}
