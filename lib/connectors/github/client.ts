// The one GitHub App client. @octokit/app mints the JWT and caches installation tokens; @octokit/webhooks verifies signatures.
import type { App } from "@octokit/app";
import { env, type Env } from "../../env";

type AppEnv = Partial<Pick<Env, "GITHUB_APP_ID" | "GITHUB_APP_PRIVATE_KEY" | "GITHUB_APP_WEBHOOK_SECRET">>;
let cached: { key: string; app: App } | undefined;

// @octokit/* are ESM-only (exports have just an "import" condition). The worker runs under tsx as CommonJS, where a static
// import dies with ERR_PACKAGE_PATH_NOT_EXPORTED and takes the whole github-reply handler with it, so they load with import().
/** null when the app isn't configured. Kept per (id, key) so the installation-token cache survives between calls. */
export async function githubApp(e: AppEnv = env()): Promise<App | null> {
  const { GITHUB_APP_ID: appId, GITHUB_APP_PRIVATE_KEY: pem, GITHUB_APP_WEBHOOK_SECRET: secret } = e;
  if (!appId || !pem) return null;
  const key = `${appId}:${pem}:${secret ?? ""}`;
  if (cached?.key === key) return cached.app;
  const { App } = await import("@octokit/app");
  const app = new App({ appId, privateKey: pem.replaceAll("\\n", "\n"), webhooks: { secret: secret ?? "unset" } });
  cached = { key, app };
  return app;
}

/** True only for a correct X-Hub-Signature-256 over the raw body. */
export async function verifySignature(secret: string, rawBody: string, signature: string | null): Promise<boolean> {
  if (!signature) return false;
  const { Webhooks } = await import("@octokit/webhooks");
  return new Webhooks({ secret }).verify(rawBody, signature).catch(() => false);
}

export type Conversion = { id: number; slug: string; pem: string; webhook_secret: string; client_id?: string; client_secret?: string; html_url: string };

/** POST /app-manifests/{code}/conversions (no auth; the code is single-use and lasts an hour). `fetcher` is a test seam. */
export async function convertManifest(code: string, fetcher: typeof fetch = fetch): Promise<Conversion> {
  const res = await fetcher(`https://api.github.com/app-manifests/${encodeURIComponent(code)}/conversions`, { method: "POST", headers: { accept: "application/vnd.github+json", "user-agent": "ripple" } });
  if (!res.ok) throw new Error(`GitHub conversion failed (${res.status})`);
  return (await res.json()) as Conversion;
}

/** Installation ids the GitHub user behind an OAuth `code` can access (user-to-server flow): proves the installer controls the installation. `fetcher` is a test seam. */
export async function userInstallations(creds: { client_id: string; client_secret: string }, code: string, fetcher: typeof fetch = fetch): Promise<number[]> {
  const tok = await fetcher("https://github.com/login/oauth/access_token", {
    method: "POST", headers: { accept: "application/json", "content-type": "application/json", "user-agent": "ripple" },
    body: JSON.stringify({ client_id: creds.client_id, client_secret: creds.client_secret, code }),
  });
  const { access_token } = (await tok.json()) as { access_token?: string };
  if (!tok.ok || !access_token) throw new Error("GitHub rejected the authorization code");
  const res = await fetcher("https://api.github.com/user/installations?per_page=100", { headers: { accept: "application/vnd.github+json", authorization: `Bearer ${access_token}`, "user-agent": "ripple" } });
  if (!res.ok) throw new Error(`GitHub user installations failed (${res.status})`);
  return ((await res.json()) as { installations: { id: number }[] }).installations.map((i) => i.id); // ponytail: first 100 installations of the user
}
