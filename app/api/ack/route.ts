import { z } from "zod";
import { decodeAckToken } from "@/lib/ack-token";
import { recordAck } from "@/lib/notify";
import { getContext } from "@/lib/server/context";

const Body = z.object({ token: z.string().min(1), kind: z.enum(["seen", "concern", "not_relevant"]) });

// POST only: opening the ack link (GET /ack/<token>) never changes state.
export async function POST(req: Request) {
  const body = Body.safeParse(await req.json().catch(() => null));
  if (!body.success) return Response.json({ error: "expected {token, kind}" }, { status: 400 });
  const t = decodeAckToken(body.data.token);
  if (t.state === "invalid") return Response.json({ error: "invalid token" }, { status: 400 });
  if (t.state === "expired") return Response.json({ error: "token expired" }, { status: 410 });
  try {
    const { teamId, decisionId } = t.payload;
    const ctx = await getContext(req);
    const { gap, by } = await recordAck(ctx.writer(), { teamId, decisionId, kind: body.data.kind });
    await ctx.audit({ action: "ack", resourceType: "decision", resourceId: decisionId, meta: { teamId, kind: body.data.kind } });
    return Response.json({ ack: { teamId, decisionId, kind: body.data.kind, by }, gap });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
