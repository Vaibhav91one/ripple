// Shared plumbing for the /api route handlers: graph lookup, 503 when FalkorDB is down, Zod-checked JSON.
import { z } from "zod";
import { graphFor, query, type Graph } from "../graph/client";
import { NotFound } from "../graph/queries";

/** Read per request so tests can point at a temp graph with RIPPLE_GRAPH; the demo tenant is `demo`. */
export const graphName = () => process.env.RIPPLE_GRAPH || "demo";
/** Epoch seconds. RIPPLE_NOW (ISO) pins the clock so the seeded wait times stay put. */
export const nowSecs = () => Math.floor((process.env.RIPPLE_NOW ? Date.parse(process.env.RIPPLE_NOW) : Date.now()) / 1000);

const json = (body: unknown, status = 200) => Response.json(body, { status });

export async function handle<S extends z.ZodType>(
  schema: S,
  fn: (g: Graph, now: number) => Promise<unknown>,
): Promise<Response> {
  let g: Graph;
  try {
    g = await graphFor(graphName());
    await query(g, "RETURN 1");
  } catch {
    return json({ error: "graph_down" }, 503);
  }
  try {
    return json(schema.parse(await fn(g, nowSecs())));
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
