import { z } from "zod";
import { env } from "@/lib/env";
import { getContext } from "@/lib/server/context";

const Body = z.object({ accountId: z.uuid() });
const KINDS = ["github", "slack"] as const;

/** Disconnect a GitHub or Slack account: admins of a signed-in org only, audited (denials too). Deletes the connector_account row, so every page reads "Not connected" on its next request. */
export async function POST(req: Request, { params }: { params: Promise<{ kind: string }> }) {
  const { kind } = await params;
  if (!KINDS.includes(kind as (typeof KINDS)[number])) return Response.json({ error: "not_found" }, { status: 404 });
  const body = Body.safeParse(await req.json().catch(() => null));
  if (!body.success) return Response.json({ error: "bad_request", message: body.error.message }, { status: 400 });
  const ctx = await getContext(req);
  const v = ctx.viewer;
  if (ctx.readonly || v.kind !== "user" || v.role !== "admin") {
    await ctx.audit({ action: "connector.disconnect", resourceType: "connector_account", resourceId: body.data.accountId, outcome: "deny", meta: { kind } });
    return Response.json({ error: "forbidden", message: "Only an org admin can disconnect a source." }, { status: 403 });
  }
  if (!env().DATABASE_URL) return Response.json({ error: "db_not_configured" }, { status: 503 });
  const { disconnect } = await import("@/lib/connectors/state");
  if (!(await disconnect(ctx.org.id, kind as (typeof KINDS)[number], body.data.accountId))) return Response.json({ error: "not_found" }, { status: 404 });
  await ctx.audit({ action: "connector.disconnect", resourceType: "connector_account", resourceId: body.data.accountId, meta: { kind } });
  return Response.json({ ok: true });
}
