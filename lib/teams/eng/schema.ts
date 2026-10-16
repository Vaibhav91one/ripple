// Eng dashboard payload: KPIs, the raw rows the screen needs, and the "ripple angle" for the v1 sunset.
// Pure (zod only) so lib/api.ts and the offline mock can import it in the browser.
import { z } from "zod";
import { Kpi, Person, RippleAngle, Incident, PrRow, System } from "@/lib/schemas";
import { kpi, median } from "../util";

export const CycleWeek = z.object({ label: z.string(), coding: z.number(), pickup: z.number(), review: z.number(), deploy: z.number(), merged: z.number() });
export const SizeBucket = z.object({ id: z.enum(["s", "m", "l", "xl"]), label: z.string(), count: z.number() });

export const EngPayload = z.object({
  team: z.literal("eng"),
  kpis: z.array(Kpi),
  angle: RippleAngle,
  prs: z.array(PrRow),
  incidents: z.array(Incident),
  services: z.array(System),
  people: z.array(Person),
  /** "today" the payload was built for, so widgets can show ages without a clock */
  now: z.number(),
  /** hours per phase of merged PRs, per week, oldest first */
  cycle: z.array(CycleWeek),
  quality: z.object({ buckets: z.array(SizeBucket), mergedWithoutReview: z.number(), merged: z.number() }),
  incidentStats: z.object({ mttaH: z.number(), mttrH: z.number() }),
});
export type EngPayload = z.infer<typeof EngPayload>;
/** The rows the cypher in lib/graph/queries/teams-eng.cypher returns, by kind (the rest is derived below). */
export const EngRows = EngPayload.omit({ team: true, kpis: true, angle: true, now: true, cycle: true, quality: true, incidentStats: true });
export type EngRows = z.infer<typeof EngRows>;

const H = 3600;
const WEEK = 7 * 86400;
export const CYCLE_WEEKS = 6;
// ponytail: the graph has no commit or deploy timestamps. Coding is estimated from diff size (1h per 150 changed lines,
// min 1h) and deploy is a flat 0.5h pipeline after merge. Swap both for real timestamps when PRs carry them.
const codingH = (p: PrRow) => Math.max(1, (p.additions + p.deletions) / 150);
const DEPLOY_H = 0.5;
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const r1 = (x: number) => Math.round(x * 10) / 10;

/** Merged PRs → per-week average hours for coding / pickup / review / deploy, for the last CYCLE_WEEKS weeks. */
export function cycleWeeks(prs: PrRow[], now: number): z.infer<typeof CycleWeek>[] {
  return Array.from({ length: CYCLE_WEEKS }, (_, i) => {
    const end = now - (CYCLE_WEEKS - 1 - i) * WEEK;
    const inWeek = prs.filter((p) => p.mergedAt !== null && p.mergedAt > end - WEEK && p.mergedAt <= end);
    const pickup = inWeek.map((p) => (p.firstReviewAt === null ? 0 : p.firstReviewAt - p.createdAt) / H);
    const review = inWeek.map((p) => (p.firstReviewAt === null ? 0 : Math.max(0, p.mergedAt! - p.firstReviewAt)) / H);
    return {
      label: new Date((end - WEEK) * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" }),
      coding: r1(avg(inWeek.map(codingH))), pickup: r1(avg(pickup)), review: r1(avg(review)),
      deploy: inWeek.length ? DEPLOY_H : 0, merged: inWeek.length,
    };
  });
}

/** PR size buckets (changed lines: S < 100, M < 400, L < 1000, XL above) over all PRs, plus merged-without-review. */
export function prQuality(prs: PrRow[]) {
  const size = (p: PrRow) => p.additions + p.deletions;
  const ids = [["s", "S · under 100"], ["m", "M · 100-399"], ["l", "L · 400-999"], ["xl", "XL · 1000+"]] as const;
  const bucket = (p: PrRow) => (size(p) < 100 ? "s" : size(p) < 400 ? "m" : size(p) < 1000 ? "l" : "xl");
  const merged = prs.filter((p) => p.state === "merged");
  return {
    buckets: ids.map(([id, label]) => ({ id, label, count: prs.filter((p) => bucket(p) === id).length })),
    mergedWithoutReview: merged.filter((p) => p.firstReviewAt === null).length,
    merged: merged.length,
  };
}

/** Mean time to acknowledge / resolve, in hours, over incidents that have the timestamp. */
export function incidentStats(incs: Incident[]) {
  const h = (pick: (i: Incident) => number | null) => r1(avg(incs.flatMap((i) => (pick(i) === null ? [] : [(pick(i)! - i.startedAt) / H]))));
  return { mttaH: h((i) => i.acknowledgedAt), mttrH: h((i) => i.resolvedAt) };
}

function kpis(r: EngRows, now: number): Kpi[] {
  const pickup = median(r.prs.flatMap((p) => (p.firstReviewAt === null ? [] : [(p.firstReviewAt - p.createdAt) / H])));
  const cycleH = median(r.prs.flatMap((p) => (p.mergedAt === null ? [] : [(p.mergedAt - p.createdAt) / H + DEPLOY_H])));
  const perWeek = r.prs.filter((p) => p.mergedAt !== null && p.mergedAt > now - 4 * WEEK).length / 4;
  const openInc = r.incidents.filter((i) => i.resolvedAt === null).length;
  return [
    kpi("pickup", "PR pickup time", pickup, "hours", pickup > 24 ? "warn" : "ok"),
    kpi("cycle", "Cycle time", cycleH, "hours", cycleH > 72 ? "warn" : "ok"),
    kpi("deploys", "Deploys per week", r1(perWeek), "count"),
    kpi("open-incidents", "Open incidents", openInc, "count", openInc > 0 ? "warn" : "ok"),
  ];
}

export const buildEng = (r: EngRows, angle: RippleAngle, now: number): EngPayload => ({
  team: "eng", kpis: kpis(r, now), angle, ...r, now,
  cycle: cycleWeeks(r.prs, now), quality: prQuality(r.prs), incidentStats: incidentStats(r.incidents),
});
