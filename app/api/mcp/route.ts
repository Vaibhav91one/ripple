import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { createRippleServer } from "@/lib/mcp/server";
import { getContext, type Context } from "@/lib/server/context";

// No LLM runs here (fixed Cypher tools only), so no Ask-style rate limit: an MCP client spends several requests per session.
// Stateless Streamable HTTP: a fresh server + transport per request, JSON responses (no SSE, no sessions).
export async function POST(req: Request): Promise<Response> {
  let ctx: Context;
  try {
    ctx = await getContext(req);
  } catch {
    return Response.json({ error: "graph_down" }, { status: 503 });
  }
  const server = createRippleServer({ g: ctx.writer(), now: ctx.now, demo: ctx.org.isDemo }, ctx.audit);
  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  await server.connect(transport);
  return transport.handleRequest(req);
}

const notAllowed = () =>
  Response.json({ jsonrpc: "2.0", error: { code: -32000, message: "Method not allowed (stateless server)." }, id: null }, { status: 405, headers: { allow: "POST" } });
export const GET = notAllowed;
export const DELETE = notAllowed;
