// One-click GitHub App setup: signed state, the manifest conversion, and storing the result. Routes stay thin.
import { decrypt, encrypt } from "../../crypto";
import { saveApp, type StoredApp } from "./app-creds";
import { convertManifest } from "./client";

const TTL = 600;
/** Stateless CSRF state: encrypted user id + nonce + expiry, so no cookie or table is needed. */
export const makeState = (userId: string, now = Date.now()) => encrypt(JSON.stringify({ u: userId, n: crypto.randomUUID(), exp: Math.floor(now / 1000) + TTL }));
export function checkState(state: string | null, userId: string, now = Date.now()): boolean {
  try { const s = JSON.parse(decrypt(state ?? "")) as { u?: string; exp?: number }; return s.u === userId && (s.exp ?? 0) >= now / 1000; } catch { return false; }
}

/** Convert, store encrypted, return where to send the admin next: the app's install page, with the same state the Connect GitHub button uses. */
export async function finishSetup(code: string, orgId: string, userId: string, fetcher?: typeof fetch): Promise<string> {
  const c = await convertManifest(code, fetcher);
  const app: StoredApp = { id: c.id, slug: c.slug, pem: c.pem, webhook_secret: c.webhook_secret, client_id: c.client_id, client_secret: c.client_secret };
  await saveApp(orgId, app);
  const install = encrypt(JSON.stringify({ o: orgId, u: userId, exp: Math.floor(Date.now() / 1000) + TTL }));
  return `${c.html_url}/installations/new?state=${encodeURIComponent(install)}`;
}
