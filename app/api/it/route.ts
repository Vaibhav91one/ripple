import { decideIt, computeIt } from "@/lib/it";
import { ItDecideBody, ItDecided, ItQueue } from "@/lib/schemas";
import { handle } from "@/lib/server/route";

/** The IT queue: access requests tied to changes, earliest change date first. */
export function GET() {
  return handle(ItQueue, computeIt);
}

/** IT grants or denies open requests, one or a whole team at once. Records the outcome; Ripple never writes to an identity provider. */
export async function POST(req: Request) {
  const body = ItDecideBody.safeParse(await req.json().catch(() => null));
  if (!body.success) return Response.json({ error: "expected {ids: string[], verb: grant|deny}" }, { status: 400 });
  return handle(ItDecided, (ctx) => decideIt(ctx, body.data.ids, body.data.verb), { action: `it.${body.data.verb}` });
}
