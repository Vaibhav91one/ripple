import { z } from "zod";
import { ackFromToken } from "@/lib/ack";
import { env } from "@/lib/env";
import { graphFor } from "@/lib/graph/client";
import { DEMO_GRAPH, getContext, graphNameFor } from "@/lib/server/context";

const Body = z.object({ token: z.string().min(1), kind: z.enum(["seen", "concern", "not_relevant"]) });

// POST only: opening the ack link (GET /ack/<token>) never changes state.
export async function POST(req: Request) {
  const body = Body.safeParse(await req.json().catch(() => null));
  if (!body.success) return Response.json({ error: "expected {token, kind}" }, { status: 400 });
  try {
    const ctx = await getContext(req);
    const r = await ackFromToken({
      ...body.data,
      // The token's org picks the graph (not the clicker's session); RIPPLE_GRAPH is the test override.
      graph: (o) => graphFor(env().RIPPLE_GRAPH || (o === DEMO_GRAPH ? DEMO_GRAPH : graphNameFor(o))),
      // only a signed-in person of the token's org counts as the actor
      actor: (o) => {
        const me = ctx.viewer.kind === "user" && ctx.viewer.orgId === o ? ctx.viewer : undefined;
        return { personId: me?.personId, auditViewer: { kind: ctx.viewer.kind, id: me?.userId } };
      },
    });
    if (!r.ok) return Response.json({ error: r.error }, { status: r.status });
    return Response.json({ ack: { teamId: r.teamId, decisionId: r.decisionId, kind: r.kind, by: r.by }, gap: r.gap });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
