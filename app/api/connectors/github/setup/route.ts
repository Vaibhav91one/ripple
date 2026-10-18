import { decrypt, encrypt } from "@/lib/crypto";
import { GITHUB_SCOPES } from "@/lib/connectors/github";
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
  let st: { o?: string; u?: string; exp?: number } = {};
  try { st = JSON.parse(decrypt(url.searchParams.get("state") ?? "")); } catch { /* bad or missing state */ }
  if (!/^\d+$/.test(installation) || st.o !== ctx.org.id || st.u !== v.userId || (st.exp ?? 0) < Date.now() / 1000) return back(req, "error=bad_state");
  const app = githubApp();
  if (!app) return back(req, "error=not_configured");
  try { await app.octokit.request("GET /app/installations/{installation_id}", { installation_id: Number(installation) }); } // the installation must belong to our app
  catch (e) { console.warn("github installation check failed:", safeMessage(e)); return back(req, "error=unknown_installation"); }

  const [{ db }, { connectorAccounts }] = await Promise.all([import("@/lib/db"), import("@/lib/db/schema")]);
  const tokenEnc = encrypt(installation);
  const [row] = await db().insert(connectorAccounts).values({ orgId: ctx.org.id, kind: "github", externalId: installation, tokenEnc, scopes: GITHUB_SCOPES })
    .onConflictDoUpdate({ target: [connectorAccounts.orgId, connectorAccounts.kind, connectorAccounts.externalId], set: { tokenEnc, scopes: GITHUB_SCOPES, status: "active" } })
    .returning({ id: connectorAccounts.id });
  await ctx.audit({ action: "connector.connect", resourceType: "connector_account", resourceId: row.id, meta: { kind: "github" } });
  await enqueue("sync", { accountId: row.id }, { singletonKey: `sync:${row.id}` });
  return back(req, "connected=1");
}
