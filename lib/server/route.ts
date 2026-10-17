// Shared plumbing for the /api route handlers: graph lookup, 503 when FalkorDB is down, Zod-checked JSON.
import { z } from "zod";
import { roQuery } from "../graph/client";
import { NotFound } from "../graph/queries";
import { getContext, type Context } from "./context";

const json = (body: unknown, status = 200) => Response.json(body, { status });

export async function handle<S extends z.ZodType>(
  schema: S,
  fn: (ctx: Context) => Promise<unknown>,
): Promise<Response> {
  let ctx: Context;
  try {
    ctx = await getContext();
    await roQuery(ctx.graph, "RETURN 1");
  } catch {
    return json({ error: "graph_down" }, 503);
  }
  try {
    return json(schema.parse(await fn(ctx))); // a route that changes state (POST /api/change) calls ctx.writer()
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
