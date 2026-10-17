import { z } from "zod";
import { id, restrictedField, ts } from "./common";
import { Decision, Source } from "./core";
import { Change } from "./ripple";
import { Blocker, WhoKnowsRow } from "./teams";

export const Kpi = z.object({
  id,
  label: z.string(),
  value: z.number(),
  unit: z.enum(["count", "usd", "percent", "hours"]),
  tone: z.enum(["ok", "warn", "bad"]).optional(),
});
/** The "Ripple angle" every team dashboard carries: what the v1 sunset means for this team. */
export const RippleAngle = z.object({
  decisionId: id.nullable(),
  affected: z.boolean(),
  involved: z.boolean(),
  acked: z.boolean(),
  changes: z.array(Change),
  facts: z.array(z.object({ text: z.string(), source: Source })).max(3),
});
export const TeamStripItem = z.object({
  teamId: id,
  name: z.string(),
  people: z.number().int(),
  affected: z.boolean(),
  told: z.boolean(),
});
export const Overview = z.object({
  now: ts,
  kpis: z.array(Kpi),
  openDecisions: z.array(z.object({ decision: Decision, notTold: z.array(id) })),
  blockers: z.array(Blocker),
  recentChanges: z.array(Change),
  activity: z.array(z.object({ day: ts, changes: z.number().int(), acks: z.number().int() })),
  whoKnows: z.array(WhoKnowsRow),
  teams: z.array(TeamStripItem),
  ...restrictedField,
});

export type Kpi = z.infer<typeof Kpi>;
export type RippleAngle = z.infer<typeof RippleAngle>;
export type TeamStripItem = z.infer<typeof TeamStripItem>;
export type Overview = z.infer<typeof Overview>;
