// One-click GitHub App setup: signed state, the manifest conversion, and storing the result. Routes stay thin.
import { decrypt, encrypt } from "../../crypto";
import { LOCK_CLAIM, saveApp, storedApp, type StoredApp } from "./app-creds";
import { convertManifest, userInstallations } from "./client";

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

/** Proves the admin controls the installation. With the app's client id/secret: exchange the OAuth `code` and require the installation in the user's own list. Without them: a GitHub `code` must at least be present (the state is checked by the caller). */
export async function verifyInstaller(installation: string, code: string | null, fetcher?: typeof fetch): Promise<"ok" | "no_code" | "foreign"> {
  if (!code) return "no_code";
  const creds = (await storedApp())?.client_id && (await storedApp())?.client_secret ? (await storedApp())! : null;
  if (!creds) return "ok";
  try { return (await userInstallations({ client_id: creds.client_id!, client_secret: creds.client_secret! }, code, fetcher)).includes(Number(installation)) ? "ok" : "foreign"; } catch { return "foreign"; }
}

/** Connects the installation to the org unless another org already holds it (first claim wins). Check + upsert run under an advisory lock in one transaction. Returns the account id, or null when taken. */
export async function bindInstallation(orgId: string, installation: string, tokenEnc: string, scopes: string[]): Promise<string | null> {
  const [{ db }, { connectorAccounts }, { and, eq, ne, sql }] = await Promise.all([import("../../db"), import("../../db/schema"), import("drizzle-orm")]);
  return db().transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(${LOCK_CLAIM})`);
    const taken = await tx.select({ id: connectorAccounts.id }).from(connectorAccounts)
      .where(and(eq(connectorAccounts.kind, "github"), eq(connectorAccounts.externalId, installation), ne(connectorAccounts.orgId, orgId))); // a unique index on external_id per kind would need a migration
    if (taken.length) return null;
    const [row] = await tx.insert(connectorAccounts).values({ orgId, kind: "github", externalId: installation, tokenEnc, scopes })
      .onConflictDoUpdate({ target: [connectorAccounts.orgId, connectorAccounts.kind, connectorAccounts.externalId], set: { tokenEnc, scopes, status: "active" } })
      .returning({ id: connectorAccounts.id });
    return row.id;
  });
}

/** Convert, store encrypted, return where to send the admin next: the app's install page, with the same state the Connect GitHub button uses. */
export async function finishSetup(code: string, orgId: string, userId: string, fetcher?: typeof fetch): Promise<string> {
  const c = await convertManifest(code, fetcher);
  const app: StoredApp = { id: c.id, slug: c.slug, pem: c.pem, webhook_secret: c.webhook_secret, client_id: c.client_id, client_secret: c.client_secret };
  await saveApp(orgId, app);
  const install = makeState(userId, "install", orgId);
  return `${c.html_url}/installations/new?state=${encodeURIComponent(install)}`;
}
