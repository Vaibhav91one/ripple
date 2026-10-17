import { env } from "@/lib/env";
import { CONNECTORS } from "@/lib/connectors";
import { handleWebhook } from "@/lib/connectors/webhook";

// POST /api/connectors/<kind>/webhook?account=<connector_account id>. The connector verifies the signature; the delivery id in each
// event's dedupeKey makes a redelivery a no-op. Returns fast: emit only inserts the event and queues the routing job.
export async function POST(req: Request, { params }: { params: Promise<{ kind: string }> }) {
  const { kind } = await params;
  const c = CONNECTORS[kind];
  if (!c?.webhook) return Response.json({ error: "unknown_connector" }, { status: 404 });
  if (!env().DATABASE_URL) return Response.json({ error: "db_not_configured" }, { status: 503 });
  return handleWebhook(c, new URL(req.url).searchParams.get("account"), req);
}
