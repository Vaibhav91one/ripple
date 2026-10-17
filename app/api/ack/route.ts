import { z } from "zod";
import { decodeAckToken } from "@/lib/ack-token";
import { recordAck } from "@/lib/notify";
import { audit } from "@/lib/audit";
import { env } from "@/lib/env";
import { graphFor } from "@/lib/graph/client";
import { DEMO_GRAPH, getContext, graphNameFor } from "@/lib/server/context";

const Body = z.object({ token: z.string().min(1), kind: z.enum(["seen", "concern", "not_relevant"]) });

// POST only: opening the ack link (GET /ack/<token>) never changes state.
export async function POST(req: Request) {
  const body = Body.safeParse(await req.json().catch(() => null));
  if (!body.success) return Response.json({ error: "expected {token, kind}" }, { status: 400 });
  const t = decodeAckToken(body.data.token);
  if (t.state === "invalid") return Response.json({ error: "invalid token" }, { status: 400 });
  if (t.state === "expired") return Response.json({ error: "token expired" }, { status: 410 });
  try {
    const { teamId, decisionId, o = DEMO_GRAPH, p } = t.payload;
    const ctx = await getContext(req);
    // The token's org picks the graph (not the clicker's session); RIPPLE_GRAPH is the test override.
    const g = await graphFor(env().RIPPLE_GRAPH || (o === DEMO_GRAPH ? DEMO_GRAPH : graphNameFor(o)));
    // Acknowledger: the signed-in person of that org, else the person the brief was sent to.
    const me = ctx.viewer.kind === "user" && ctx.viewer.orgId === o ? ctx.viewer : undefined;
    const { gap, by } = await recordAck(g, { teamId, decisionId, kind: body.data.kind, by: me?.personId ?? p });
    await audit(
      { org: { id: o }, viewer: { kind: ctx.viewer.kind, id: me?.userId } },
      { action: "ack", resourceType: "decision", resourceId: decisionId, meta: { teamId, kind: body.data.kind, by } },
    );
    return Response.json({ ack: { teamId, decisionId, kind: body.data.kind, by }, gap });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
