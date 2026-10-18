// Contract for GET /api/analytics (#232): "Is Ripple closing the loop?" for the focus change (latest open decision, or ?case=).
// Computed from the graph and the event log. Fixture: lib/schemas/fixtures/analytics.json.
import { z } from "zod";
import { id, restrictedField, ts } from "./common";

const Pts = z.number().int();
export const CoverageCard = z.object({
  caseId: id,
  title: z.string(),
  pct: z.number().int().min(0).max(100),
  targetPct: z.literal(100),
  /** points gained vs yesterday (graph edge dates) */
  deltaPts: Pts,
  teams: z.object({ told: z.number().int(), affected: z.number().int() }),
  acks: z.object({ done: z.number().int(), of: z.number().int() }),
  customers: z.object({ notified: z.number().int(), of: z.number().int(), demo: z.boolean() }),
  /** coverage per day since the announcement; the last point is today */
  trend: z.array(z.object({ day: ts, pct: z.number().int(), today: z.boolean() })),
});
export const WaterfallStep = z.object({
  id,
  label: z.string(),
  teamId: id.nullable(),
  teams: z.number().int(),
  pts: Pts, // points of coverage lost to this reason
  /** null = restricted or not attributable to this reason */
  arrAtRisk: z.number().int().nullable(),
  /** one sentence that explains the number */
  note: z.string(),
});
export const Waterfall = z.object({ targetPct: z.literal(100), steps: z.array(WaterfallStep), actualPct: z.number().int(), takeaway: z.string() });

export const GapType = z.enum(["not_told", "not_acked", "contract_conflict", "overdue"]);
export const Heatmap = z.object({
  teams: z.array(z.object({ teamId: id, name: z.string() })),
  columns: z.array(GapType),
  cells: z.array(z.object({ teamId: id, gap: GapType, count: z.number().int(), arrAtRisk: z.number().int().nullable() })),
});

export const Scenario = z.object({
  id,
  label: z.string(),
  teamId: id,
  pts: Pts,
  /** pending = a real pending_actions row; derived = what telling this team would be worth (no row yet) */
  source: z.enum(["pending", "derived"]),
  actionId: z.string().nullable(),
});
export const Forecast = z.object({
  effectiveAt: ts.nullable(),
  daysLeft: z.number().int().nullable(),
  currentPct: z.number().int(),
  /** at the pace so far, by the effective date */
  projectedPct: z.number().int(),
  /** if every scenario is approved; the UI toggles scenarios and sums `pts` */
  withApprovalsPct: z.number().int(),
  scenarios: z.array(Scenario),
});
export const TimeToTell = z.object({
  rows: z.array(z.object({ teamId: id, name: z.string(), hours: z.number().int().nullable(), toldAt: ts.nullable(), waitingHours: z.number().int().nullable() })),
  medianHours: z.number().int().nullable(),
});
export const AgentStats = z.object({
  proposed: z.number().int(), approved: z.number().int(), rejected: z.number().int(), pending: z.number().int(),
  /** approved / decided, 0..100; null when nothing is decided yet */
  approvalRatePct: z.number().int().nullable(),
  medianDecisionHours: z.number().nullable(),
  byKind: z.array(z.object({ kind: z.string(), proposed: z.number().int(), approved: z.number().int() })),
  /** true when there is no approvals table (no Postgres) and the numbers are seeded demo history */
  demo: z.boolean(),
});
export const Analytics = z.object({
  now: ts,
  coverage: CoverageCard.nullable(),
  waterfall: Waterfall.nullable(),
  heatmap: Heatmap,
  forecast: Forecast.nullable(),
  timeToTell: TimeToTell,
  agents: AgentStats,
  ...restrictedField,
});
export type Analytics = z.infer<typeof Analytics>;
export type Scenario = z.infer<typeof Scenario>;
export type GapType = z.infer<typeof GapType>;
