import { computeOverview } from "@/lib/overview";
import { handle } from "@/lib/server/route";
import { Overview } from "@/lib/schemas";

export const GET = () => handle(Overview, ({ graph, now }) => computeOverview(graph, now));
