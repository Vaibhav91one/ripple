import { me } from "@/lib/me";
import { getContext } from "@/lib/server/context";

/** The viewer in plain words: mode (demo, local or clerk), name, role, org, teams and the demo lens. Works with no account. */
export async function GET(req: Request) {
  return Response.json(await me(await getContext(req)), { headers: { "cache-control": "private, no-store" } }); // per viewer: never shared by a cache
}
