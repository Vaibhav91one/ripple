// Leadership dashboard payload: KPIs, the raw rows the screen needs, and the "ripple angle" for the v1 sunset.
// Pure (zod only) so lib/api.ts and the offline mock can import it in the browser.
import { z } from "zod";
import { Kpi, Person, RippleAngle, Blocker, Decision, Goal, Risk } from "@/lib/schemas";
import { kpi, type Rows } from "../util";

export const LeadershipPayload = z.object({
  team: z.literal("leadership"),
  kpis: z.array(Kpi),
  angle: RippleAngle,
  now: z.number(),
  goals: z.array(Goal),
  risks: z.array(Risk),
  blockers: z.array(Blocker),
  decisions: z.array(Decision),
  people: z.array(Person),
});
export type LeadershipPayload = z.infer<typeof LeadershipPayload>;
/** The rows the cypher in lib/graph/queries/teams-leadership.cypher returns, by kind. */
export const LeadershipRows = LeadershipPayload.omit({ team: true, kpis: true, angle: true, now: true });
export type LeadershipRows = Omit<Rows<LeadershipPayload>, "now">;

function kpis(r: LeadershipRows, now: number): Kpi[] {
  void now;
  const n = (s: Goal["status"]) => r.goals.filter((g) => g.status === s).length;
  const open = r.decisions.filter((d) => d.status !== "superseded").length;
  return [
    kpi("on-track", "Goals on track", n("on_track"), "count", "ok"),
    kpi("at-risk", "Goals at risk", n("at_risk"), "count", n("at_risk") > 0 ? "warn" : "ok"),
    kpi("off-track", "Goals off track", n("off_track"), "count", n("off_track") > 0 ? "bad" : "ok"),
    kpi("open-decisions", "Open decisions", open, "count"),
  ];
}

export const buildLeadership = (r: LeadershipRows, angle: RippleAngle, now: number): LeadershipPayload => ({
  team: "leadership", kpis: kpis(r, now), angle, now, ...r,
});
