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
    cache = { at: Date.now(), app: null }; // a down database is not retried on every delivery
    return null;
  }
  return cache.app;
}

const envApp = (e: Env) => !!(e.GITHUB_APP_ID && e.GITHUB_APP_PRIVATE_KEY);

/** One app per instance: "env" (env creds win, setup is closed), "stored" (one app already created here, a second is refused) or "open". */
export async function setupStatus(): Promise<"env" | "stored" | "open"> {
  if (envApp(env())) return "env";
  clearStoredApp();
  return (await storedApp()) ? "stored" : "open";
}

/** Secrets a webhook may be signed with: the env one and the single stored one (both accepted so a migration never drops deliveries). */
export async function webhookSecrets(): Promise<string[]> {
  return [env().GITHUB_APP_WEBHOOK_SECRET, (await storedApp())?.webhook_secret].filter((x): x is string => !!x);
}

/** env() as is when it holds an app; otherwise the stored app's id, key, secret and slug laid over it. Pass the result to githubApp(). */
export async function githubEnv(): Promise<GithubEnv> {
  const e = env();
  const s = envApp(e) ? null : await storedApp();
  return s ? { ...e, GITHUB_APP_ID: String(s.id), GITHUB_APP_PRIVATE_KEY: s.pem, GITHUB_APP_WEBHOOK_SECRET: s.webhook_secret, GITHUB_APP_SLUG: s.slug } : e;
}

/** Advisory lock keys: two concurrent setups (or claims) queue on these inside their transaction, so check + insert is atomic. */
export const LOCK_APP = 236_001;
export const LOCK_CLAIM = 236_002;

export async function saveApp(orgId: string, app: StoredApp): Promise<void> {
  if ((await setupStatus()) !== "open") throw new Error("a GitHub App is already configured on this server");
  const [{ db }, { connectorAccounts }, { eq, sql }] = await Promise.all([import("../../db"), import("../../db/schema"), import("drizzle-orm")]);
  const tokenEnc = encrypt(JSON.stringify(app));
  await db().transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(${LOCK_APP})`);
    if ((await tx.select({ id: connectorAccounts.id }).from(connectorAccounts).where(eq(connectorAccounts.kind, APP_KIND))).length) throw new Error("a GitHub App is already configured on this server");
    await tx.insert(connectorAccounts).values({ orgId, kind: APP_KIND, externalId: String(app.id), tokenEnc });
  });
  clearStoredApp();
}
