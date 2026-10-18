const MOVED = new Set(["github", "slack", "csv", "upload"]);

/** v1 setup URLs (/connectors/github?connected=1 ...) moved under /connections (#238); the query string comes along. Relative Location (see lib/server/redirect.ts). */
export async function GET(req: Request, { params }: { params: Promise<{ kind: string }> }) {
  const { kind } = await params;
  if (!MOVED.has(kind)) return new Response("Not found", { status: 404 });
  return new Response(null, { status: 308, headers: { location: `/connections/${kind}${new URL(req.url).search}` } });
}
