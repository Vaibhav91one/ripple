import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { graphFor } from "@/lib/graph/client";
import { createRippleServer } from "@/lib/mcp/server";
import { graphName, nowSecs } from "@/lib/server/route";

// No LLM runs here (fixed Cypher tools only), so no Ask-style rate limit: an MCP client spends several requests per session.
// Stateless Streamable HTTP: a fresh server + transport per request, JSON responses (no SSE, no sessions).
export async function POST(req: Request): Promise<Response> {
  let g;
  try {
    g = await graphFor(graphName());
  } catch {
    return Response.json({ error: "graph_down" }, { status: 503 });
  }
  const server = createRippleServer({ g, now: nowSecs(), demo: true });
  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  await server.connect(transport);
  return transport.handleRequest(req);
}

const notAllowed = () =>
  Response.json({ jsonrpc: "2.0", error: { code: -32000, message: "Method not allowed (stateless server)." }, id: null }, { status: 405, headers: { allow: "POST" } });
export const GET = notAllowed;
export const DELETE = notAllowed;
