// GitHub App credentials created by the one-click manifest flow (/setup/github). Stored encrypted in connector_account
// (kind "github-app", token_enc = encrypted JSON). Stored values win over env; with none stored, env is used as before.
import { env, type Env } from "../../env";
import { decrypt, encrypt } from "../../crypto";

export const APP_KIND = "github-app";
export type StoredApp = { id: number; slug: string; pem: string; webhook_secret: string; client_id?: string; client_secret?: string };
export type GithubEnv = Pick<Env, "GITHUB_APP_ID" | "GITHUB_APP_PRIVATE_KEY" | "GITHUB_APP_WEBHOOK_SECRET" | "GITHUB_APP_SLUG"> & Partial<Env>;

let cache: { at: number; app: StoredApp | null } | undefined;
export const clearStoredApp = () => { cache = undefined; };

/** Newest stored app of this instance (one GitHub App serves every org), or null. No DATABASE_URL or a read failure = null. */
export async function storedApp(): Promise<StoredApp | null> {
  if (!env().DATABASE_URL) return null;
  if (cache && Date.now() - cache.at < 30_000) return cache.app;
  try {
    const [{ db }, { connectorAccounts }, { eq, desc }] = await Promise.all([import("../../db"), import("../../db/schema"), import("drizzle-orm")]);
    const [row] = await db().select({ t: connectorAccounts.tokenEnc }).from(connectorAccounts).where(eq(connectorAccounts.kind, APP_KIND)).orderBy(desc(connectorAccounts.createdAt)).limit(1);
    cache = { at: Date.now(), app: row?.t ? (JSON.parse(decrypt(row.t)) as StoredApp) : null };
  } catch (e) {
    console.warn("[github] stored app lookup failed:", e instanceof Error ? e.message : e);
    return null;
  }
  return cache.app;
}

/** env() with the stored app's id, key, secret and slug laid over it. Pass the result to githubApp(). */
export async function githubEnv(): Promise<GithubEnv> {
  const e = env();
  const s = await storedApp();
  return s ? { ...e, GITHUB_APP_ID: String(s.id), GITHUB_APP_PRIVATE_KEY: s.pem, GITHUB_APP_WEBHOOK_SECRET: s.webhook_secret, GITHUB_APP_SLUG: s.slug } : e;
}

export async function saveApp(orgId: string, app: StoredApp): Promise<void> {
  const [{ db }, { connectorAccounts }] = await Promise.all([import("../../db"), import("../../db/schema")]);
  const tokenEnc = encrypt(JSON.stringify(app));
  await db().insert(connectorAccounts).values({ orgId, kind: APP_KIND, externalId: String(app.id), tokenEnc })
    .onConflictDoUpdate({ target: [connectorAccounts.orgId, connectorAccounts.kind, connectorAccounts.externalId], set: { tokenEnc, status: "active" } });
  clearStoredApp();
}
