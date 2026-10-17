import { z } from "zod";
import { env } from "@/lib/env";
import { getContext } from "@/lib/server/context";

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const tz = z.string().refine((s) => { try { new Intl.DateTimeFormat("en-US", { timeZone: s }); return true; } catch { return false; } }, "unknown time zone");
const chans = z.array(z.enum(["slack_dm", "email", "inbox"]));
const Body = z.object({
  scope: z.enum(["me", "org"]),
  channels: z.object({ high: chans, normal: chans, low: chans }).partial(),
  tz,
  quietStart: time.nullable(),
  quietEnd: time.nullable(),
  digest: z.boolean().optional(), // scope me
  digestDay: z.enum(["mon", "tue", "wed", "thu", "fri", "sat", "sun", "off"]).optional(), // scope org
});

/** Signed-in users save their own preferences; org defaults need an admin. Anonymous demo viewers get 403. */
export async function PUT(req: Request) {
  const ctx = await getContext(req);
  const body = Body.safeParse(await req.json().catch(() => null));
  if (!body.success) return Response.json({ error: "bad_request", message: body.error.message }, { status: 400 });
  const { scope, ...v } = body.data;
  const viewer = ctx.viewer;
  if (viewer.kind !== "user" || (scope === "org" && viewer.role !== "admin")) {
    await ctx.audit({ action: `notify_prefs.${scope}`, resourceType: "notify_prefs", outcome: "deny" });
    return Response.json({ error: "forbidden" }, { status: 403 });
  }
  if (!env().DATABASE_URL) return Response.json({ error: "db_not_configured" }, { status: 503 });
  const { saveOrgDefault, savePersonPrefs } = await import("@/lib/notify/prefs");
  if (scope === "org") await saveOrgDefault(ctx.org.id, v);
  else await savePersonPrefs(ctx.org.id, viewer.userId, viewer.personId, v);
  await ctx.audit({ action: `notify_prefs.${scope}`, resourceType: "notify_prefs", resourceId: scope === "me" ? viewer.userId : ctx.org.id, meta: v });
  return Response.json({ ok: true });
}
