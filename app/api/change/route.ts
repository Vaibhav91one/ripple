import { z } from "zod";
import { changeSunset, ripple } from "@/lib/graph/queries";
import { handle } from "@/lib/server/route";
import { RippleResult } from "@/lib/schemas";


const Body = z.object({ decisionId: z.string().min(1), newOn: z.number().int() });

/** Live change: move the decision's sunset to `newOn` (epoch seconds) and return the re-run ripple. */
export async function POST(req: Request) {
  const body = Body.safeParse(await req.json().catch(() => null));
  if (!body.success) return Response.json({ error: "bad_request", message: body.error.message }, { status: 400 });
  const { decisionId, newOn } = body.data;
  return handle(RippleResult, async (ctx) => {
    const { now } = ctx;
    await ripple(ctx.graph, decisionId, now); // 404 for an unknown decision before anything is written
    await changeSunset(ctx.writer(), decisionId, newOn, now);
    await ctx.audit({ action: "change", resourceType: "decision", resourceId: decisionId, meta: { newOn } });
    return ripple(ctx.graph, decisionId, now);
  });
}
