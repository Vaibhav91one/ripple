/** API keys moved to Integrations, next to the MCP endpoint they unlock. */
export function GET(req: Request) {
  return Response.redirect(new URL("/integrations#api-keys", req.url), 308);
}
