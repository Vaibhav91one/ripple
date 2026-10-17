import { z } from "zod";
import { env } from "@/lib/env";
import { ActionError } from "@/lib/actions/decide";
import { denyIfReadonly } from "@/lib/server/route";
import { getContext } from "@/lib/server/context";

const Body = z.object({ decision: z.enum(["approve", "reject"]), note: z.string().trim().max(500).optional(), bulk: z.boolean().optional() });

/** Approve or reject one action, or (`bulk`) every pending action of the same kind and change. 403 when the role may not decide that kind. */
export async function POST(req: Request, route: { params: Promise<{ id: string }> }) {
  const { id } = await route.params;
  const ctx = await getContext(req);
  const body = Body.safeParse(await req.json().catch(() => null));
  if (!body.success || !z.string().uuid().safeParse(id).success) return Response.json({ error: "bad_request" }, { status: 400 });
  const denied = await denyIfReadonly(ctx, `action.${body.data.decision}`, id);
  if (denied) return denied;
  if (!env().DATABASE_URL) return Response.json({ error: "db_not_configured" }, { status: 503 });
  const { decideMany } = await import("@/lib/approvals/service");
  const viewer = { kind: ctx.viewer.kind, id: ctx.viewer.kind === "user" ? ctx.viewer.userId : undefined, role: ctx.viewer.role };
  try {
    const results = await decideMany({ org: ctx.org, viewer }, id, body.data.decision, body.data);
    if (body.data.note) await ctx.audit({ action: "action.note", resourceType: "action", resourceId: id, meta: { decision: body.data.decision, note: body.data.note } });
    return Response.json({ results });
  } catch (e) {
    if (e instanceof ActionError) return Response.json({ error: e.status === 403 ? "forbidden" : "not_found", message: e.message }, { status: e.status });
    throw e;
  }
}
