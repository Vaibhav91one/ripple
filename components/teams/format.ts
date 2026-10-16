import type { Kpi } from "@/lib/schemas";

/** Format a KPI value by its unit: 1,240 · $180k · 82% · 4.5h. */
export function formatKpi(unit: Kpi["unit"], v: number): string {
  if (unit === "usd") return v >= 1_000_000 ? `$${(v / 1_000_000).toFixed(1)}M` : v >= 1000 ? `$${Math.round(v / 1000)}k` : `$${v}`;
  if (unit === "percent") return `${Math.round(v)}%`;
  if (unit === "hours") return v < 1 ? `${Math.round(v * 60)}m` : `${v.toFixed(1)}h`;
  return v.toLocaleString("en-US");
}

/** Epoch seconds → "Oct 12". */
export const fmtDay = (ts: number) => new Date(ts * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
