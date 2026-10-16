// Sales dashboard payload: KPIs, the raw rows the screen needs, and the "ripple angle" for the v1 sunset.
// Pure (zod only) so lib/api.ts and the offline mock can import it in the browser.
import { z } from "zod";
import { Kpi, Person, RippleAngle, Deal, Goal } from "@/lib/schemas";
import { kpi, type Rows } from "../util";

export const SalesPayload = z.object({
  team: z.literal("sales"),
  kpis: z.array(Kpi),
  angle: RippleAngle,
  deals: z.array(Deal),
  goals: z.array(Goal),
  people: z.array(Person),
});
export type SalesPayload = z.infer<typeof SalesPayload>;
/** The rows the cypher in lib/graph/queries/teams-sales.cypher returns, by kind. */
export const SalesRows = SalesPayload.omit({ team: true, kpis: true, angle: true });
export type SalesRows = Rows<SalesPayload>;

function kpis(r: SalesRows, now: number): Kpi[] {
  void now;
  const open = r.deals.filter((d) => d.stage !== "closed_won" && d.stage !== "closed_lost");
  const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
  const won = sum(r.deals.filter((d) => d.stage === "closed_won").map((d) => d.amount));
  const goal = r.goals[0];
  const v1 = open.filter((d) => d.v1Related).length;
  return [
    kpi("pipeline", "Open pipeline", sum(open.map((d) => d.amount)), "usd"),
    kpi("forecast", "Weighted forecast", Math.round(sum(open.map((d) => (d.amount * d.probability) / 100))), "usd"),
    kpi("closed-won", "Closed won", won, "usd", "ok"),
    kpi("goal", "Quarter goal reached", goal?.progress ?? 0, "percent", goal?.status === "on_track" ? "ok" : "warn"),
    kpi("v1-deals", "Open deals that promised API v1", v1, "count", v1 > 0 ? "warn" : "ok"),
  ];
}

export const buildSales = (r: SalesRows, angle: RippleAngle, now: number): SalesPayload => ({
  team: "sales", kpis: kpis(r, now), angle, ...r,
});
