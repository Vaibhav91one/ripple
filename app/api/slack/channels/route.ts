import { NextResponse } from "next/server";
import { z } from "zod";
import { env } from "@/lib/env";
import { getContext } from "@/lib/server/context";

const Form = z.object({ teamId: z.string().min(1), channelId: z.string().regex(/^([CG][A-Z0-9]{2,})?$/, "a Slack channel id like C0123ABC, or empty to clear") });

// POST /api/slack/channels (form): sets or clears the Slack channel a team's channel notifications go to. Admins only.
export async function POST(req: Request) {
  const ctx = await getContext(req);
  const back = (q: string) => NextResponse.redirect(new URL(`/connectors/slack?${q}`, req.url), 303);
  if (ctx.readonly || ctx.viewer.kind !== "user" || ctx.viewer.role !== "admin") return Response.json({ error: "forbidden" }, { status: 403 });
  if (!env().DATABASE_URL) return Response.json({ error: "db_not_configured" }, { status: 503 });
  const f = Form.safeParse(Object.fromEntries(await req.formData()));
  if (!f.success) return back("error=channel");
  await (await import("@/lib/connectors/slack/store")).setTeamChannel(ctx.org.id, f.data.teamId, f.data.channelId);
  await ctx.audit({ action: "slack.team_channel", resourceType: "team", resourceId: f.data.teamId, meta: { channelId: f.data.channelId } });
  return back("saved=1");
}
