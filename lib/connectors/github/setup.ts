// One-click GitHub App setup: signed state, the manifest conversion, and storing the result. Routes stay thin.
import { decrypt, encrypt } from "../../crypto";
import { saveApp, type StoredApp } from "./app-creds";
import { convertManifest } from "./client";

const TTL = 600;
type Purpose = "manifest" | "install";
const used = new Map<string, number>(); // nonce -> exp; single use. ponytail: per process, a restart forgets (the TTL still bounds replay)

/** Stateless CSRF state: encrypted purpose + user (+ org) + nonce + expiry. */
export const makeState = (userId: string, purpose: Purpose = "manifest", orgId?: string, now = Date.now()) =>
  encrypt(JSON.stringify({ p: purpose, u: userId, o: orgId, n: crypto.randomUUID(), exp: Math.floor(now / 1000) + TTL }));
/** Valid, unexpired, for this purpose and user (and org when given). `consume` marks the nonce spent so a replay fails. */
export function checkState(state: string | null, userId: string, purpose: Purpose = "manifest", orgId?: string, consume = false, now = Date.now()): boolean {
  try {
    const s = JSON.parse(decrypt(state ?? "")) as { p?: string; u?: string; o?: string; n?: string; exp?: number };
    if (s.p !== purpose || s.u !== userId || (s.exp ?? 0) < now / 1000 || (orgId && s.o !== orgId) || !s.n || used.has(s.n)) return false;
    if (consume) { for (const [k, e] of used) if (e < now / 1000) used.delete(k); used.set(s.n, s.exp!); }
    return true;
  } catch { return false; }
}

/** True when this GitHub installation is already connected to a different org: first claim wins. (A unique index on external_id per kind would need a migration; enforced here.) */
export async function installationTaken(installation: string, orgId: string): Promise<boolean> {
  const [{ db }, { connectorAccounts }, { and, eq, ne }] = await Promise.all([import("../../db"), import("../../db/schema"), import("drizzle-orm")]);
  const rows = await db().select({ id: connectorAccounts.id }).from(connectorAccounts)
    .where(and(eq(connectorAccounts.kind, "github"), eq(connectorAccounts.externalId, installation), ne(connectorAccounts.orgId, orgId)));
  return rows.length > 0;
}

/** Convert, store encrypted, return where to send the admin next: the app's install page, with the same state the Connect GitHub button uses. */
export async function finishSetup(code: string, orgId: string, userId: string, fetcher?: typeof fetch): Promise<string> {
  const c = await convertManifest(code, fetcher);
  const app: StoredApp = { id: c.id, slug: c.slug, pem: c.pem, webhook_secret: c.webhook_secret, client_id: c.client_id, client_secret: c.client_secret };
  await saveApp(orgId, app);
  const install = makeState(userId, "install", orgId);
  return `${c.html_url}/installations/new?state=${encodeURIComponent(install)}`;
}
