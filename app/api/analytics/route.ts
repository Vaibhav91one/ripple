import { z } from "zod";
import { computeAnalytics } from "@/lib/analytics";
import { bad, handle, params } from "@/lib/server/route";
import { Analytics } from "@/lib/schemas/analytics";

/** Coverage vs target, the waterfall, heatmap, forecast, time to tell and agent stats for the focus change (`case` picks another). */
export function GET(req: Request) {
  const q = params(req, z.object({ case: z.string().min(1).optional() }));
  if (bad(q)) return q;
  return handle(Analytics, (ctx) => computeAnalytics(ctx, q.case));
}
