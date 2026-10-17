// Shared plumbing for the /api route handlers: graph lookup, 503 when FalkorDB is down, Zod-checked JSON.
import { z } from "zod";
import { roQuery } from "../graph/client";
import { NotFound } from "../graph/queries";
import { loadIndex, redact } from "../permissions/redact";
import { getContext, type Context } from "./context";

export const DEMO_READONLY = "demo_readonly";

/** 403 + a `deny` audit event for anonymous demo viewers; null when the write may go ahead. Call before any state changes. */
export async function denyIfReadonly(ctx: Context, action: string, resourceId?: string): Promise<Response | null> {
  if (!ctx.readonly) return null;
  await ctx.audit({ action, resourceType: "decision", resourceId, outcome: "deny" });
  return Response.json({ error: DEMO_READONLY }, { status: 403 });
}

const json = (body: unknown, status = 200) => Response.json(body, { status });

export async function handle<S extends z.ZodType>(
  schema: S,
  fn: (ctx: Context) => Promise<unknown>,
  write?: { action: string; resourceId?: string },
): Promise<Response> {
  let ctx: Context;
  try {
    ctx = await getContext();
    await roQuery(ctx.graph, "RETURN 1");
  } catch {
    return json({ error: "graph_down" }, 503);
  }
  if (write) {
    const denied = await denyIfReadonly(ctx, write.action, write.resourceId);
    if (denied) return denied;
  }
  try {
    // a route that changes state (POST /api/change) calls ctx.writer()
    const r = redact(await fn(ctx), ctx.viewer, await loadIndex(ctx.graph)); // server-side, before parse: restricted payload never leaves
    const body: unknown = schema.parse(r.value);
    return json(r.restricted.length && body && typeof body === "object" && !Array.isArray(body) ? { ...body, restricted: r.restricted } : body);
  } catch (e) {
    if (e instanceof NotFound) return json({ error: "not_found", message: e.message }, 404);
    return json({ error: "internal", message: e instanceof Error ? e.message : String(e) }, 500);
  }
}

/** Parse query params with Zod; a bad request is a 400 and never reaches the graph. */
export function params<S extends z.ZodType>(req: Request, schema: S): z.infer<S> | Response {
  const r = schema.safeParse(Object.fromEntries(new URL(req.url).searchParams));
  return r.success ? r.data : json({ error: "bad_request", message: r.error.message }, 400);
}
export const bad = (v: unknown): v is Response => v instanceof Response;
