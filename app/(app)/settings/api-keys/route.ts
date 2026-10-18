/** API keys moved to Integrations, next to the MCP endpoint they unlock. Relative Location: behind the proxy req.url is the internal origin. */
export function GET() {
  return new Response(null, { status: 308, headers: { location: "/integrations#api-keys" } });
}
