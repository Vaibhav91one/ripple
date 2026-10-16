// Eng dashboard payload: KPIs, the raw rows the screen needs, and the "ripple angle" for the v1 sunset.
// Pure (zod only) so lib/api.ts and the offline mock can import it in the browser.
import { z } from "zod";
import { Kpi, Person, RippleAngle, Incident, PrRow, System } from "@/lib/schemas";
import { kpi, mean, median, type Rows } from "../util";

export const EngPayload = z.object({
  team: z.literal("eng"),
  kpis: z.array(Kpi),
  angle: RippleAngle,
  prs: z.array(PrRow),
  incidents: z.array(Incident),
  services: z.array(System),
  people: z.array(Person),
});
export type EngPayload = z.infer<typeof EngPayload>;
/** The rows the cypher in lib/graph/queries/teams-eng.cypher returns, by kind. */
export const EngRows = EngPayload.omit({ team: true, kpis: true, angle: true });
export type EngRows = Rows<EngPayload>;

function kpis(r: EngRows, now: number): Kpi[] {
  void now;
  const merged = r.prs.filter((p) => p.state === "merged");
  const unreviewed = merged.filter((p) => p.firstReviewAt === null).length;
  const open = r.prs.filter((p) => p.state === "open").length;
  const review = median(r.prs.flatMap((p) => (p.firstReviewAt === null ? [] : [(p.firstReviewAt - p.createdAt) / 3600])));
  const openInc = r.incidents.filter((i) => i.resolvedAt === null).length;
  const mttr = mean(r.incidents.flatMap((i) => (i.resolvedAt === null ? [] : [(i.resolvedAt - i.startedAt) / 3600])));
  return [
    kpi("open-prs", "Open PRs", open, "count", open > 6 ? "warn" : "ok"),
    kpi("unreviewed-merges", "Merged without review", unreviewed, "count", unreviewed > 0 ? "bad" : "ok"),
    kpi("review-time", "Median time to first review", review, "hours", review > 24 ? "warn" : "ok"),
    kpi("open-incidents", "Open incidents", openInc, "count", openInc > 0 ? "warn" : "ok"),
    kpi("mttr", "Mean time to resolve", mttr, "hours"),
  ];
}

export const buildEng = (r: EngRows, angle: RippleAngle, now: number): EngPayload => ({
  team: "eng", kpis: kpis(r, now), angle, ...r,
});
