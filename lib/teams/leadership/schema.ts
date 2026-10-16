// Leadership dashboard payload: KPIs, the raw rows the screen needs, and the "ripple angle" for the v1 sunset.
// Pure (zod only) so lib/api.ts and the offline mock can import it in the browser.
import { z } from "zod";
import { Kpi, Person, RippleAngle, Blocker, Decision, Goal, Risk } from "@/lib/schemas";
import { kpi, type Rows } from "../util";

export const LeadershipPayload = z.object({
  team: z.literal("leadership"),
  kpis: z.array(Kpi),
  angle: RippleAngle,
  goals: z.array(Goal),
  risks: z.array(Risk),
  blockers: z.array(Blocker),
  decisions: z.array(Decision),
  people: z.array(Person),
});
export type LeadershipPayload = z.infer<typeof LeadershipPayload>;
/** The rows the cypher in lib/graph/queries/teams-leadership.cypher returns, by kind. */
export const LeadershipRows = LeadershipPayload.omit({ team: true, kpis: true, angle: true });
export type LeadershipRows = Rows<LeadershipPayload>;

function kpis(r: LeadershipRows, now: number): Kpi[] {
  void now;
  const off = r.goals.filter((g) => g.status === "off_track").length;
  const atRisk = r.goals.filter((g) => g.status === "at_risk").length;
  const high = r.risks.filter((k) => k.likelihood * k.impact >= 15 && k.status !== "accepted").length;
  const avg = r.goals.length ? Math.round(r.goals.reduce((a, g) => a + g.progress, 0) / r.goals.length) : 0;
  return [
    kpi("off-track", "Goals off track", off, "count", off > 0 ? "bad" : "ok"),
    kpi("at-risk", "Goals at risk", atRisk, "count", atRisk > 0 ? "warn" : "ok"),
    kpi("high-risks", "High risks", high, "count", high > 0 ? "warn" : "ok"),
    kpi("blockers", "Blockers", r.blockers.length, "count", r.blockers.length > 0 ? "warn" : "ok"),
    kpi("progress", "Average goal progress", avg, "percent"),
  ];
}

export const buildLeadership = (r: LeadershipRows, angle: RippleAngle, now: number): LeadershipPayload => ({
  team: "leadership", kpis: kpis(r, now), angle, ...r,
});
