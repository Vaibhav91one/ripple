import { z } from "zod";
import { env } from "@/lib/env";
import { getContext, type Context } from "@/lib/server/context";

type Admin = Context & { viewer: Extract<Context["viewer"], { kind: "user" }> };

/** Admin-only gate shared by the three verbs: 403 (+ deny audit row) for anyone else, 503 without Postgres. */
async function admin(req: Request, action: string): Promise<{ ctx: Admin } | { res: Response }> {
  const ctx = await getContext(req);
  if (ctx.viewer.kind !== "user" || ctx.viewer.role !== "admin") {
    await ctx.audit({ action, resourceType: "api_key", outcome: "deny" });
    return { res: Response.json({ error: "forbidden" }, { status: 403 }) };
  }
  if (!env().DATABASE_URL) return { res: Response.json({ error: "db_not_configured" }, { status: 503 }) };
  return { ctx: ctx as Admin };
}

export async function GET(req: Request) {
  const a = await admin(req, "apikey.list");
  if ("res" in a) return a.res;
  const { listKeys } = await import("@/lib/api-keys");
  return Response.json({ keys: await listKeys(a.ctx.org.id) });
}

const Create = z.object({ name: z.string().trim().min(1).max(80) });

/** Mints a key for the calling admin (it acts with their teams and role). The plaintext is in this response only. */
export async function POST(req: Request) {
  const a = await admin(req, "apikey.create");
  if ("res" in a) return a.res;
  const body = Create.safeParse(await req.json().catch(() => null));
  if (!body.success) return Response.json({ error: "bad_request", message: body.error.message }, { status: 400 });
  const { createKey } = await import("@/lib/api-keys");
  const k = await createKey(a.ctx.org.id, a.ctx.viewer.userId, body.data.name);
  await a.ctx.audit({ action: "apikey.create", resourceType: "api_key", resourceId: k.id, meta: { name: body.data.name, prefix: k.prefix } });
  return Response.json({ id: k.id, prefix: k.prefix, key: k.key }, { status: 201, headers: { "cache-control": "no-store" } });
}

const Revoke = z.object({ id: z.string().uuid() });

export async function DELETE(req: Request) {
  const a = await admin(req, "apikey.revoke");
  if ("res" in a) return a.res;
  const body = Revoke.safeParse(await req.json().catch(() => null));
  if (!body.success) return Response.json({ error: "bad_request", message: body.error.message }, { status: 400 });
  const { revokeKey } = await import("@/lib/api-keys");
  if (!(await revokeKey(a.ctx.org.id, body.data.id))) return Response.json({ error: "not_found" }, { status: 404 });
  await a.ctx.audit({ action: "apikey.revoke", resourceType: "api_key", resourceId: body.data.id });
  return Response.json({ ok: true });
}
