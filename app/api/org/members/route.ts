import { z } from "zod";
import { env } from "@/lib/env";
import { getContext } from "@/lib/server/context";

const Patch = z.object({
  userId: z.string().min(1),
  role: z.enum(["member", "lead", "admin", "change_owner"]).optional(),
  teamIds: z.array(z.string().min(1)).optional(),
  personId: z.string().min(1).nullable().optional(),
});

/** Admin-only: change a member's teams, role or person link. Non-admins get 403 and a deny audit row. */
export async function PATCH(req: Request) {
  const ctx = await getContext(req);
  if (ctx.viewer.kind !== "user" || ctx.viewer.role !== "admin") {
    await ctx.audit({ action: "member.update", resourceType: "member", outcome: "deny" });
    return Response.json({ error: "forbidden" }, { status: 403 });
  }
  if (!env().DATABASE_URL) return Response.json({ error: "db_not_configured" }, { status: 503 });
  const body = Patch.safeParse(await req.json().catch(() => null));
  if (!body.success) return Response.json({ error: "bad_request", message: body.error.message }, { status: 400 });
  const { updateMember } = await import("@/lib/members");
  if (!(await updateMember(ctx.org.id, body.data))) return Response.json({ error: "not_found" }, { status: 404 });
  await ctx.audit({ action: "member.update", resourceType: "member", resourceId: body.data.userId, meta: body.data });
  return Response.json({ ok: true });
}
