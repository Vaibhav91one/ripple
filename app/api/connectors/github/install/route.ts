import { makeState } from "@/lib/connectors/github/setup";
import { githubEnv } from "@/lib/connectors/github/app-creds";
import { getContext } from "@/lib/server/context";

/** GET: 'Connect GitHub' -> the app's install page. `state` is encrypted (org + user + 10 min expiry) and comes back to /setup. Admins only. */
export async function GET(req: Request) {
  const ctx = await getContext(req);
  const v = ctx.viewer;
  if (ctx.readonly || v.kind !== "user" || v.role !== "admin") return Response.json({ error: "forbidden" }, { status: 403 });
  const slug = (await githubEnv()).GITHUB_APP_SLUG;
  if (!slug) return Response.json({ error: "github_app_not_configured" }, { status: 503 });
  const state = makeState(v.userId, "install", ctx.org.id);
  return Response.redirect(`https://github.com/apps/${encodeURIComponent(slug)}/installations/new?state=${encodeURIComponent(state)}`, 302);
}
