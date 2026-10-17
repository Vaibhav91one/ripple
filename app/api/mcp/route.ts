import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { createRippleServer } from "@/lib/mcp/server";
import { ApiKeyError, getContext, type Context } from "@/lib/server/context";

// No LLM runs here (fixed Cypher tools only), so no Ask-style rate limit: an MCP client spends several requests per session.
// Stateless Streamable HTTP: a fresh server + transport per request, JSON responses (no SSE, no sessions).
export async function POST(req: Request): Promise<Response> {
  let ctx: Context;
  try {
    ctx = await getContext(req);
  } catch (e) {
    if (e instanceof ApiKeyError) return Response.json({ error: "unauthorized" }, { status: 401, headers: { "www-authenticate": 'Bearer realm="ripple"' } });
    return Response.json({ error: "graph_down" }, { status: 503 });
  }
  // The anonymous demo is read-only: a write tool call is refused here (403) before the MCP layer runs.
  if (ctx.readonly) {
    const body = await req.clone().json().catch(() => null);
    const calls = (Array.isArray(body) ? body : [body]).filter((m) => m?.method === "tools/call");
    if (calls.some((m) => m.params?.name === "ack_brief")) {
      await ctx.audit({ action: "mcp.tool", resourceType: "tool", resourceId: "ack_brief", outcome: "deny" });
      return Response.json({ error: "forbidden", message: "Anonymous MCP is read-only. Use an API key." }, { status: 403 });
    }
  }
  const server = createRippleServer({ g: ctx.writer(), now: ctx.now, demo: ctx.org.isDemo, readonly: ctx.readonly, viewer: ctx.viewer }, ctx.audit);
  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  await server.connect(transport);
  return transport.handleRequest(req);
}

const notAllowed = () =>
  Response.json({ jsonrpc: "2.0", error: { code: -32000, message: "Method not allowed (stateless server)." }, id: null }, { status: 405, headers: { allow: "POST" } });
export const GET = notAllowed;
export const DELETE = notAllowed;
