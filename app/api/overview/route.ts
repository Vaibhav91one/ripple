import { computeOverview } from "@/lib/overview";
import { handle } from "@/lib/server/route";
import { Overview } from "@/lib/schemas";

export const GET = () => handle(Overview, (g, now) => computeOverview(g, now));
