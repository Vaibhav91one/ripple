// Org API keys for /api/mcp. Format `rpl_<prefix>_<secret>` (hex); only sha256(key) is stored, the key is shown once at creation.
import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "./db";
import { apiKeys, orgs } from "./db/schema";

export const hashKey = (key: string) => createHash("sha256").update(key).digest("hex");

/** Mint a key for `viewerUserId` (the creator: the key acts with their teams and role). Returns the plaintext once. */
export async function createKey(orgId: string, viewerUserId: string, name: string, d = db()) {
  const prefix = randomBytes(4).toString("hex");
  const key = `rpl_${prefix}_${randomBytes(24).toString("hex")}`;
  const [row] = await d.insert(apiKeys).values({ orgId, keyHash: hashKey(key), prefix, name, viewerUserId }).returning({ id: apiKeys.id });
  return { id: row.id, key, prefix };
}

/** Never returns the hash. */
export const listKeys = (orgId: string, d = db()) =>
  d.select({ id: apiKeys.id, name: apiKeys.name, prefix: apiKeys.prefix, viewerUserId: apiKeys.viewerUserId, createdAt: apiKeys.createdAt, revokedAt: apiKeys.revokedAt, lastUsedAt: apiKeys.lastUsedAt })
    .from(apiKeys).where(eq(apiKeys.orgId, orgId)).orderBy(desc(apiKeys.createdAt));

/** False when the key is not in this org or already revoked. */
export async function revokeKey(orgId: string, id: string, d = db()): Promise<boolean> {
  const r = await d.update(apiKeys).set({ revokedAt: new Date() }).where(and(eq(apiKeys.orgId, orgId), eq(apiKeys.id, id), isNull(apiKeys.revokedAt))).returning({ id: apiKeys.id });
  return r.length > 0;
}

/** Hash lookup. Unknown or revoked -> null (callers answer 401); a live key gets `last_used_at` touched. */
export async function resolveKey(key: string, d = db()) {
  const [row] = await d.select({ id: apiKeys.id, orgId: apiKeys.orgId, viewerUserId: apiKeys.viewerUserId, revokedAt: apiKeys.revokedAt, graphName: orgs.graphName })
    .from(apiKeys).innerJoin(orgs, eq(orgs.id, apiKeys.orgId)).where(eq(apiKeys.keyHash, hashKey(key)));
  if (!row || row.revokedAt) return null;
  await d.update(apiKeys).set({ lastUsedAt: new Date() }).where(eq(apiKeys.id, row.id));
  return row;
}
