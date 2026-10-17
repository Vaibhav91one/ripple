import { env } from "@/lib/env";
import { agent } from "@/lib/agent/registry";
import { SettingsPatch } from "@/lib/schemas";
import { getContext } from "@/lib/server/context";

/** Admin-only: switch an agent on or off for the org, and set auto-approve for the action kinds it writes. Audited, allowed or denied. */
export async function PATCH(req: Request, route: { params: Promise<{ name: string }> }) {
  const { name } = await route.params;
  const ctx = await getContext(req);
  const res = { resourceType: "agent", resourceId: name };
  if (ctx.viewer.kind !== "user" || ctx.viewer.role !== "admin") {
    await ctx.audit({ action: "agent.settings", outcome: "deny", ...res });
    return Response.json({ error: "forbidden" }, { status: 403 });
  }
  const def = agent(name);
  if (!def) return Response.json({ error: "not_found" }, { status: 404 });
  if (!env().DATABASE_URL) return Response.json({ error: "db_not_configured" }, { status: 503 });
  const body = SettingsPatch.safeParse(await req.json().catch(() => null));
  const unknown = body.success && Object.keys(body.data.autoApprove ?? {}).find((k) => !def.writes.includes(k as never));
  if (!body.success || unknown) return Response.json({ error: "bad_request", message: unknown ? `${name} does not write ${unknown}` : body.error?.message }, { status: 400 });
  const { saveSettings } = await import("@/lib/approvals/service");
  await saveSettings(ctx.org.id, name, body.data);
  await ctx.audit({ action: "agent.settings", ...res, meta: body.data });
  return Response.json({ ok: true });
}
