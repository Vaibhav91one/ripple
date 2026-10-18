import { env } from "@/lib/env";

/** Redirect with a relative Location. Behind the Zerops proxy req.url is the internal https://0.0.0.0:3000, so never build the target from it. */
export const redirectTo = (path: string, status: 302 | 303 = 302) => new Response(null, { status, headers: { location: path } });

/** Public origin for absolute links: APP_URL, else the proxy's x-forwarded-host/proto, else req.url. */
export function publicOrigin(req: Request): string {
  const app = env().APP_URL;
  if (app) return app.replace(/\/+$/, "");
  const host = req.headers.get("x-forwarded-host")?.split(",")[0].trim();
  if (host) return `${req.headers.get("x-forwarded-proto")?.split(",")[0].trim() || "https"}://${host}`;
  return new URL(req.url).origin;
}
