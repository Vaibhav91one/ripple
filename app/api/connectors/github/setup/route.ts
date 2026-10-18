import { encrypt } from "@/lib/crypto";
import { bindInstallation, checkState, verifyInstaller } from "@/lib/connectors/github/setup";
import { GITHUB_SCOPES } from "@/lib/connectors/github";
import { githubEnv } from "@/lib/connectors/github/app-creds";
import { githubApp } from "@/lib/connectors/github/client";
import { safeMessage } from "@/lib/log";
import { enqueue } from "@/lib/queue";
import { redirectTo } from "@/lib/server/redirect";
import { getContext } from "@/lib/server/context";

const back = (_req: Request, q: string) => redirectTo(`/connections/github?${q}`);

/** GET (the app's Setup URL): GitHub sends the admin back with ?installation_id&state. Stores the installation id, encrypted, for this org, then queues the first sync. */
export async function GET(req: Request) {
  const ctx = await getContext(req);
  const v = ctx.viewer;
  if (ctx.readonly || v.kind !== "user" || v.role !== "admin") return Response.json({ error: "forbidden" }, { status: 403 });
  const url = new URL(req.url);
  const installation = url.searchParams.get("installation_id") ?? "";
  if (!/^\d+$/.test(installation) || !checkState(url.searchParams.get("state"), v.userId, "install", ctx.org.id, true)) return back(req, "error=bad_state");
  const app = githubApp(await githubEnv());
  if (!app) return back(req, "error=not_configured");
  try { await app.octokit.request("GET /app/installations/{installation_id}", { installation_id: Number(installation) }); } // the installation must belong to our app
  catch (e) { console.warn("github installation check failed:", safeMessage(e)); return back(req, "error=unknown_installation"); }

  if ((await verifyInstaller(installation, url.searchParams.get("code"))) !== "ok") return back(req, "error=unverified_installation"); // the admin must prove they control this installation
  const id = await bindInstallation(ctx.org.id, installation, encrypt(installation), GITHUB_SCOPES);
  if (!id) return back(req, "error=installation_taken");
  const row = { id };
  await ctx.audit({ action: "connector.connect", resourceType: "connector_account", resourceId: row.id, meta: { kind: "github" } });
  await enqueue("sync", { accountId: row.id }, { singletonKey: `sync:${row.id}` });
  return back(req, "connected=1");
}
