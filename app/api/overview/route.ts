import { computeOverview } from "@/lib/overview";
import { handle } from "@/lib/server/route";
import { seesSummaries, owns } from "@/lib/permissions/redact";
import { Overview } from "@/lib/schemas";

export const GET = () =>
  handle(Overview, async ({ graph, now, viewer }) => {
    const o = await computeOverview(graph, now);
    // "ARR at risk" is customer ARR: Sales owns it, leadership sees the total
    return owns(viewer, "sales") || seesSummaries(viewer) ? o : { ...o, kpis: o.kpis.filter((k) => k.id !== "arr-at-risk") };
  });
