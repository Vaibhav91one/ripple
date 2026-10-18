// OAuth v2 install: authorize URL out, code exchange in, bot token stored encrypted.
import { encrypt } from "../../crypto";
import { env } from "../../env";
import type { SaveInstall } from "./store";

export const SLACK_SCOPES = [
  "chat:write", "chat:write.public", "channels:manage", "channels:join", "channels:read", "channels:history",
  "groups:write", "groups:history", "im:write", "users:read", "users:read.email", "pins:write", "commands",
  "app_mentions:read", "im:history", "assistant:write", "groups:read",
];
export const redirectUri = () => `${env().APP_URL ?? ""}/api/slack/oauth`;

export function authorizeUrl(state: string): string {
  const u = new URL("https://slack.com/oauth/v2/authorize");
  u.search = new URLSearchParams({ client_id: env().SLACK_CLIENT_ID ?? "", scope: SLACK_SCOPES.join(","), redirect_uri: redirectUri(), state }).toString();
  return u.toString();
}

type Deps = { fetch?: typeof fetch; save: (i: SaveInstall) => Promise<void> };

/** Exchange the code, encrypt the bot token, save. Returns the team id. Throws (with no secret in the message) on a failed exchange. */
export async function completeInstall(orgId: string, code: string, deps: Deps): Promise<string> {
  const { SLACK_CLIENT_ID, SLACK_CLIENT_SECRET } = env();
  if (!SLACK_CLIENT_ID || !SLACK_CLIENT_SECRET) throw new Error("SLACK_CLIENT_ID / SLACK_CLIENT_SECRET are not set");
  const res = await (deps.fetch ?? fetch)("https://slack.com/api/oauth.v2.access", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: SLACK_CLIENT_ID, client_secret: SLACK_CLIENT_SECRET, code, redirect_uri: redirectUri() }),
  });
  const b = (await res.json()) as { ok: boolean; error?: string; access_token?: string; scope?: string; team?: { id: string } };
  if (!b.ok || !b.access_token || !b.team?.id) throw new Error(`slack oauth.v2.access: ${b.error ?? "no token"}`);
  await deps.save({ orgId, teamId: b.team.id, tokenEnc: encrypt(b.access_token), scopes: (b.scope ?? "").split(",").filter(Boolean) });
  return b.team.id;
}
