import { z } from "zod";
import { notifyGaps } from "@/lib/notify";
import { getContext } from "@/lib/server/context";

const Body = z.object({ decisionId: z.string().min(1) });

export async function POST(req: Request) {
  const body = Body.safeParse(await req.json().catch(() => null));
  if (!body.success) return Response.json({ error: "expected {decisionId}" }, { status: 400 });
  try {
    const results = await notifyGaps((await getContext(req)).writer(), body.data.decisionId, { baseUrl: new URL(req.url).origin });
    return Response.json({ decisionId: body.data.decisionId, results });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
