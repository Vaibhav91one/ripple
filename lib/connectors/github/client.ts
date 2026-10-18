// The one GitHub App client. @octokit/app mints the JWT and caches installation tokens; @octokit/webhooks verifies signatures.
import { App } from "@octokit/app";
import { Webhooks } from "@octokit/webhooks";
import { env, type Env } from "../../env";

type AppEnv = Partial<Pick<Env, "GITHUB_APP_ID" | "GITHUB_APP_PRIVATE_KEY" | "GITHUB_APP_WEBHOOK_SECRET">>;
let cached: { key: string; app: App } | undefined;

/** null when the app isn't configured. Kept per (id, key) so the installation-token cache survives between calls. */
export function githubApp(e: AppEnv = env()): App | null {
  const { GITHUB_APP_ID: appId, GITHUB_APP_PRIVATE_KEY: pem, GITHUB_APP_WEBHOOK_SECRET: secret } = e;
  if (!appId || !pem) return null;
  const key = `${appId}:${pem}:${secret ?? ""}`;
  if (cached?.key !== key) cached = { key, app: new App({ appId, privateKey: pem.replaceAll("\\n", "\n"), webhooks: { secret: secret ?? "unset" } }) };
  return cached.app;
}

/** True only for a correct X-Hub-Signature-256 over the raw body. */
export async function verifySignature(secret: string, rawBody: string, signature: string | null): Promise<boolean> {
  if (!signature) return false;
  return new Webhooks({ secret }).verify(rawBody, signature).catch(() => false);
}

export type Conversion = { id: number; slug: string; pem: string; webhook_secret: string; client_id?: string; client_secret?: string; html_url: string };

/** POST /app-manifests/{code}/conversions (no auth; the code is single-use and lasts an hour). `fetcher` is a test seam. */
export async function convertManifest(code: string, fetcher: typeof fetch = fetch): Promise<Conversion> {
  const res = await fetcher(`https://api.github.com/app-manifests/${encodeURIComponent(code)}/conversions`, { method: "POST", headers: { accept: "application/vnd.github+json", "user-agent": "ripple" } });
  if (!res.ok) throw new Error(`GitHub conversion failed (${res.status})`);
  return (await res.json()) as Conversion;
}
