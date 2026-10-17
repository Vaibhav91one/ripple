// Sales dashboard payload: KPIs, the raw rows the screen needs, and the "ripple angle" for the v1 sunset.
// Pure (zod only) so lib/api.ts and the offline mock can import it in the browser.
import { z } from "zod";
import { Kpi, Person, RippleAngle, Deal, Goal, Source } from "@/lib/schemas";
import { restrictedField } from "@/lib/schemas/common";
import { kpi, type Rows } from "../util";

export const SalesPayload = z.object({
  team: z.literal("sales"),
  kpis: z.array(Kpi),
  angle: RippleAngle,
  ...restrictedField,
  deals: z.array(Deal),
  goals: z.array(Goal),
  people: z.array(Person),
  /** PROMISED edges: the sourced line where a deal was told API v1 stays */
  promises: z.array(z.object({ dealId: z.string(), source: Source })),
  /** quarter forecast, derived from deals and the quarter goal */
  forecast: z.object({ goal: z.number(), closed: z.number(), gap: z.number(), commit: z.number(), bestCase: z.number(), weighted: z.number() }),
});
export type SalesPayload = z.infer<typeof SalesPayload>;
/** The rows the cypher in lib/graph/queries/teams-sales.cypher returns, by kind. */
export const SalesRows = SalesPayload.omit({ team: true, restricted: true, kpis: true, angle: true, forecast: true });
export type SalesRows = Omit<Rows<SalesPayload>, "forecast">;

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const isOpen = (d: Deal) => d.stage !== "closed_won" && d.stage !== "closed_lost";

function forecast(r: SalesRows): SalesPayload["forecast"] {
  const open = r.deals.filter(isOpen);
  const closed = sum(r.deals.filter((d) => d.stage === "closed_won").map((d) => d.amount));
  const goal = r.goals[0]?.target ?? 0;
  return {
    goal, closed, gap: Math.max(0, goal - closed),
    commit: sum(open.filter((d) => d.stage === "negotiation").map((d) => d.amount)),
    bestCase: sum(open.map((d) => d.amount)),
    weighted: Math.round(sum(open.map((d) => (d.amount * d.probability) / 100))),
  };
}

function kpis(r: SalesRows, f: SalesPayload["forecast"]): Kpi[] {
  const open = r.deals.filter(isOpen);
  const v1 = open.filter((d) => d.v1Related).length;
  const goal = r.goals[0];
  return [
    kpi("pipeline", "Open pipeline", f.bestCase, "usd"),
    kpi("weighted", "Weighted pipeline", f.weighted, "usd"),
    kpi("coverage", "Pipeline coverage", f.gap ? (f.bestCase / f.gap) * 100 : 0, "percent", f.bestCase >= 3 * f.gap ? "ok" : "warn"),
    kpi("closed-won", "Closed won", f.closed, "usd", "ok"),
    kpi("goal", "Quarter goal reached", goal?.progress ?? 0, "percent", goal?.status === "on_track" ? "ok" : "warn"),
    kpi("v1-deals", "Open deals that promised API v1", v1, "count", v1 > 0 ? "warn" : "ok"),
  ];
}

export function buildSales(r: SalesRows, angle: RippleAngle, now: number): SalesPayload {
  void now;
  const f = forecast(r);
  return { team: "sales", kpis: kpis(r, f), angle, ...r, forecast: f };
}
