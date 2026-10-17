import { computeHome } from "@/lib/home";
import { handle } from "@/lib/server/route";
import { Home } from "@/lib/schemas";

/** Everything that needs the viewer today, for the viewer's team (the demo "view as" lens or the signed-in member). */
export function GET() {
  return handle(Home, computeHome);
}
