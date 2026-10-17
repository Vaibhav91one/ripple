// Read side for /connectors. Never selects token_enc or the cursor.
import "server-only";
import { desc, eq } from "drizzle-orm";
import { db } from "../db";
import { connectorAccounts } from "../db/schema";

export type AccountRow = { id: string; kind: string; externalId: string; status: string; scopes: string[]; lastSyncAt: string | null };

export async function listAccounts(orgId: string): Promise<AccountRow[]> {
  const rows = await db().select({
    id: connectorAccounts.id, kind: connectorAccounts.kind, externalId: connectorAccounts.externalId,
    status: connectorAccounts.status, scopes: connectorAccounts.scopes, lastSyncAt: connectorAccounts.lastSyncAt,
  }).from(connectorAccounts).where(eq(connectorAccounts.orgId, orgId)).orderBy(desc(connectorAccounts.createdAt));
  return rows.map((r) => ({ ...r, lastSyncAt: r.lastSyncAt?.toISOString() ?? null }));
}
