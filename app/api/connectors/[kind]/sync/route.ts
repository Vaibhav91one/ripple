import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { env } from "@/lib/env";
import { enqueue } from "@/lib/queue";
import { getContext } from "@/lib/server/context";

const Body = z.object({ accountId: z.uuid() });

/** "Sync now": admins only. One queued sync per account (the queue's singletonKey), so a double click is one job. */
export async function POST(req: Request, { params }: { params: Promise<{ kind: string }> }) {
  const { kind } = await params;
  const ctx = await getContext(req);
  const body = Body.safeParse(await req.json().catch(() => null));
  if (!body.success) return Response.json({ error: "bad_request", message: body.error.message }, { status: 400 });
  const v = ctx.viewer;
  if (v.kind !== "user" || v.role !== "admin") {
    await ctx.audit({ action: "connector.sync", resourceType: "connector_account", resourceId: body.data.accountId, outcome: "deny" });
    return Response.json({ error: "forbidden" }, { status: 403 });
  }
  if (!env().DATABASE_URL) return Response.json({ error: "db_not_configured" }, { status: 503 });
  const [{ db }, { connectorAccounts }] = await Promise.all([import("@/lib/db"), import("@/lib/db/schema")]);
  const [acct] = await db().select({ id: connectorAccounts.id }).from(connectorAccounts)
    .where(and(eq(connectorAccounts.id, body.data.accountId), eq(connectorAccounts.orgId, ctx.org.id), eq(connectorAccounts.kind, kind)));
  if (!acct) return Response.json({ error: "not_found" }, { status: 404 });
  const job = await enqueue("sync", { accountId: acct.id }, { singletonKey: `sync:${acct.id}` });
  await ctx.audit({ action: "connector.sync", resourceType: "connector_account", resourceId: acct.id, meta: { queued: !!job } });
  return Response.json({ ok: true, queued: !!job }, { status: 202 });
}
