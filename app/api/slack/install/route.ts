import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { env } from "@/lib/env";
import { authorizeUrl } from "@/lib/connectors/slack/install";
import { redirectTo } from "@/lib/server/redirect";
import { getContext } from "@/lib/server/context";

// GET /api/slack/install: the 'Connect Slack' button. Admins only; a random state cookie guards the callback against CSRF.
export async function GET() {
  const ctx = await getContext();
  if (ctx.readonly || ctx.viewer.kind !== "user" || ctx.viewer.role !== "admin") return redirectTo("/connections/slack?error=forbidden");
  if (!env().SLACK_CLIENT_ID || !env().APP_URL) return redirectTo("/connections/slack?error=not_configured");
  const state = randomBytes(16).toString("base64url");
  const res = NextResponse.redirect(authorizeUrl(state));
  res.cookies.set("slack_oauth_state", state, { httpOnly: true, sameSite: "lax", secure: true, path: "/api/slack", maxAge: 600 });
  return res;
}
