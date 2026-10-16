// Pure helpers shared by the team payload builders.
import type { Kpi } from "@/lib/schemas";

export type Rows<P> = Omit<P, "team" | "kpis" | "angle">;
const r1 = (x: number) => Math.round(x * 10) / 10;
export const mean = (xs: number[]) => (xs.length ? r1(xs.reduce((a, b) => a + b, 0) / xs.length) : 0);
export const median = (xs: number[]) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return r1(s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2);
};
export const kpi = (id: string, label: string, value: number, unit: Kpi["unit"], tone?: Kpi["tone"]): Kpi =>
  ({ id, label, value, unit, ...(tone ? { tone } : {}) });

const DAY = 86400;
export const ACTIVITY_DAYS = 14;

/** Changes (edges added) and acks (ACKED edges) per day for the last 14 days, oldest first. */
export function activitySeries(edges: { type: string; at: number }[], now: number) {
  const today = Math.floor(now / DAY) * DAY;
  const series = Array.from({ length: ACTIVITY_DAYS }, (_, i) => ({ day: today - (ACTIVITY_DAYS - 1 - i) * DAY, changes: 0, acks: 0 }));
  for (const e of edges) {
    const slot = series[ACTIVITY_DAYS - 1 - Math.floor((today - Math.floor(e.at / DAY) * DAY) / DAY)];
    if (!slot) continue;
    if (e.type === "ACKED") slot.acks++;
    else slot.changes++;
  }
  return series;
}
