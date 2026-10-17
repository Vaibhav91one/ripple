import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "../db";
import { connectorAccounts } from "../db/schema";
import { decrypt } from "../crypto";
import { emit } from "../events/emit";
import { RippleEvent } from "../events/types";
import { safeMessage } from "../log";
import { BadSignature, type Connector } from "./define";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function handleWebhook(c: Connector, accountId: string | null, req: Request): Promise<Response> {
  if (!accountId || !UUID.test(accountId)) return Response.json({ error: "unknown_account" }, { status: 404 });
  const [row] = await db().select().from(connectorAccounts).where(and(eq(connectorAccounts.id, accountId), eq(connectorAccounts.kind, c.kind)));
  if (!row) return Response.json({ error: "unknown_account" }, { status: 404 });
  let events: Awaited<ReturnType<NonNullable<Connector["webhook"]>>>;
  try {
    const token = row.tokenEnc ? decrypt(row.tokenEnc) : null;
    events = await c.webhook!(req, { id: row.id, orgId: row.orgId, kind: row.kind, externalId: row.externalId, token, scopes: row.scopes });
  } catch (e) {
    console.warn(`[webhook] ${c.kind} ${e instanceof BadSignature ? "rejected" : "failed"}:`, safeMessage(e));
    if (e instanceof BadSignature) return Response.json({ error: "bad_signature" }, { status: 400 });
    return Response.json({ error: "processing_failed" }, { status: 502 }); // verified but not processed: the provider redelivers
  }
  if (events === "ignored") return Response.json({ ok: true, ignored: true });
  let inserted = 0;
  for (const ev of events) {
    const parsed = RippleEvent.parse({ ...ev, orgId: row.orgId }); // an event can only land in the account's own org
    if ((await emit(db(), parsed)).inserted) inserted++;
  }
  return Response.json({ ok: true, received: events.length, inserted });
}
