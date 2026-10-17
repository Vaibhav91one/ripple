import { encrypt } from "@/lib/crypto";
import { env } from "@/lib/env";
import { getContext } from "@/lib/server/context";

/** GET: 'Connect GitHub' -> the app's install page. `state` is encrypted (org + user + 10 min expiry) and comes back to /setup. Admins only. */
export async function GET(req: Request) {
  const ctx = await getContext(req);
  const v = ctx.viewer;
  if (ctx.readonly || v.kind !== "user" || v.role !== "admin") return Response.json({ error: "forbidden" }, { status: 403 });
  const slug = env().GITHUB_APP_SLUG;
  if (!slug) return Response.json({ error: "github_app_not_configured" }, { status: 503 });
  const state = encrypt(JSON.stringify({ o: ctx.org.id, u: v.userId, exp: Math.floor(Date.now() / 1000) + 600 }));
  return Response.redirect(`https://github.com/apps/${encodeURIComponent(slug)}/installations/new?state=${encodeURIComponent(state)}`, 302);
}
