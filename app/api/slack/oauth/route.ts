import { NextResponse } from "next/server";
import { safeMessage } from "@/lib/log";
import { completeInstall } from "@/lib/connectors/slack/install";
import { saveInstall } from "@/lib/connectors/slack/store";
import { redirectTo } from "@/lib/server/redirect";
import { getContext } from "@/lib/server/context";

// GET /api/slack/oauth?code&state: Slack's redirect. Checks the state cookie, exchanges the code, stores the encrypted bot token.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const back = (q: string) => {
    const res = new NextResponse(null, redirectTo(`/connectors/slack?${q}`));
    res.cookies.delete({ name: "slack_oauth_state", path: "/api/slack" }); // single use
    return res;
  };
  const code = url.searchParams.get("code");
  const state = /(?:^|;\s*)slack_oauth_state=([\w-]+)/.exec(req.headers.get("cookie") ?? "")?.[1];
  if (url.searchParams.get("error")) return back("error=denied");
  if (!code || !state || state !== url.searchParams.get("state")) return back("error=state");
  const ctx = await getContext();
  if (ctx.readonly || ctx.viewer.kind !== "user" || ctx.viewer.role !== "admin") return Response.json({ error: "forbidden" }, { status: 403 });
  try {
    await completeInstall(ctx.org.id, code, { save: saveInstall });
  } catch (e) {
    console.error("[slack] install failed:", safeMessage(e));
    return back("error=install");
  }
  return back("connected=1");
}
