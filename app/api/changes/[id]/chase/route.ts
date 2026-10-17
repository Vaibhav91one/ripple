import { z } from "zod";
import { ripple } from "@/lib/graph/queries";
import { handle } from "@/lib/server/route";

const Body = z.object({ teamId: z.string().min(1) });

/** Chase a team: propose a reminder (send_reminder) for the change. Nothing is sent until someone approves it (Approvals tab). */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = Body.safeParse(await req.json().catch(() => null));
  if (!body.success) return Response.json({ error: "bad_request", message: body.error.message }, { status: 400 });
  const { teamId } = body.data;
  return handle(z.object({ id: z.string(), status: z.string() }), async (c) => {
    const r = await ripple(c.graph, id, c.now);
    if (!r.teams.some((t) => t.teamId === teamId)) throw new Error("team is not affected by this change");
    const { propose } = await import("@/lib/actions/propose");
    return propose(
      { org: c.org, viewer: { kind: c.viewer.kind, id: c.viewer.kind === "user" ? c.viewer.userId : undefined } },
      "send_reminder",
      { decisionId: id, teamId, title: `Chase ${teamId}: ${r.decision.title}` },
    );
  }, { action: "chase", resourceId: id });
}
