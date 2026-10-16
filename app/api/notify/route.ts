import { z } from "zod";
import { DEMO_GRAPH } from "@/lib/briefs";
import { graphFor } from "@/lib/graph/client";
import { notifyGaps } from "@/lib/notify";

const Body = z.object({ decisionId: z.string().min(1) });

export async function POST(req: Request) {
  const body = Body.safeParse(await req.json().catch(() => null));
  if (!body.success) return Response.json({ error: "expected {decisionId}" }, { status: 400 });
  try {
    const results = await notifyGaps(await graphFor(DEMO_GRAPH()), body.data.decisionId, { baseUrl: new URL(req.url).origin });
    return Response.json({ decisionId: body.data.decisionId, results });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
