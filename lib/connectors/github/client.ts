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
