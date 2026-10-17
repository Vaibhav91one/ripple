import { z } from "zod";
import { notifyGaps } from "@/lib/notify";
import { denyIfReadonly } from "@/lib/server/route";
import { getContext } from "@/lib/server/context";

const Body = z.object({ decisionId: z.string().min(1) });

export async function POST(req: Request) {
  const body = Body.safeParse(await req.json().catch(() => null));
  if (!body.success) return Response.json({ error: "expected {decisionId}" }, { status: 400 });
  try {
    const ctx = await getContext(req);
    const denied = await denyIfReadonly(ctx, "notify", body.data.decisionId);
    if (denied) return denied;
    const results = await notifyGaps(ctx.writer(), body.data.decisionId, { orgId: ctx.org.id, baseUrl: new URL(req.url).origin });
    await ctx.audit({ action: "notify", resourceType: "decision", resourceId: body.data.decisionId, meta: { teams: results.map((r) => r.teamId) } });
    return Response.json({ decisionId: body.data.decisionId, results });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
