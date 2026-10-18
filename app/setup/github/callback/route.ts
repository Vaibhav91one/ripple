import { finishSetup, checkState } from "@/lib/connectors/github/setup";
import { safeMessage } from "@/lib/log";
import { getContext } from "@/lib/server/context";
import { redirectTo } from "@/lib/server/redirect";

/** GET (the manifest's redirect_url): GitHub sends ?code&state after the admin creates the app. Verifies state, converts the code, stores the app, sends the admin to install it. */
export async function GET(req: Request) {
  const ctx = await getContext(req);
  const v = ctx.viewer;
  if (ctx.readonly || v.kind !== "user" || v.role !== "admin") return Response.json({ error: "forbidden" }, { status: 403 });
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  if (!code || !checkState(url.searchParams.get("state"), v.userId)) return redirectTo("/setup/github?error=bad_state");
  try {
    const next = await finishSetup(code, ctx.org.id, v.userId);
    await ctx.audit({ action: "connector.connect", resourceType: "github_app", resourceId: "manifest", meta: { kind: "github" } });
    return Response.redirect(next, 302);
  } catch (e) {
    console.warn("github manifest setup failed:", safeMessage(e));
    return redirectTo("/setup/github?error=conversion_failed");
  }
}
