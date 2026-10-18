// Pure view model for /analytics: GET /api/analytics -> sentences, heatmap grid, ranked actions, forecast math. No React.
import type { Analytics, GapType, Scenario } from "@/lib/schemas/analytics";

type A = Analytics;

/** $950, $62K, $1.2M (ARR is whole dollars). */
export function fmtUsd(n: number): string {
  const a = Math.abs(n);
  const s = a >= 1e6 ? `${trim(a / 1e6)}M` : a >= 1e3 ? `${trim(a / 1e3)}K` : `${Math.round(a)}`;
  return `${n < 0 ? "−" : ""}$${s}`;
}
const trim = (v: number) => (v >= 100 ? Math.round(v).toString() : v.toFixed(1).replace(/\.0$/, ""));

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** "Jan 31" in UTC, so server and client agree. */
export const fmtDay = (ts: number) => { const d = new Date(ts * 1000); return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`; };

/** 36 h, 25 days. */
export const fmtHours = (h: number) => (h < 48 ? `${Math.round(h)} h` : `${Math.round(h / 24)} days`);

export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** Points then dollars, margin's "−1.6 pts · $7.7K". */
export const stepText = (pts: number, arr: number | null) => `−${pts} pts${arr ? ` · ${fmtUsd(arr)}` : ""}`;

/** ARR still exposed: the one figure the API puts on the contract-conflict cell. null = none attributable, or restricted. */
export const exposedArr = (a: A): number | null => a.heatmap.cells.find((c) => c.gap === "contract_conflict" && c.arrAtRisk !== null)?.arrAtRisk ?? null;

/** "40% of affected teams told. 3 teams and $180K ARR still exposed before Jan 31." */
export function coverageSentence(a: A): string {
  const c = a.coverage;
  if (!c) return "No open change to measure yet.";
  const left = c.teams.affected - c.teams.told;
  const arr = exposedArr(a);
  const when = a.forecast?.effectiveAt ? ` before ${fmtDay(a.forecast.effectiveAt)}` : "";
  if (left === 0) return `${c.pct}% of affected teams told. Every team that the change reaches has heard.`;
  return `${c.pct}% of affected teams told. ${plural(left, "team")}${arr ? ` and ${fmtUsd(arr)} ARR` : ""} still exposed${when}.`;
}

/** Waterfall axis: start a little under the actual, ticks every 10 or 20 points. */
export function waterfallAxis(actual: number) {
  const min = Math.max(0, Math.floor((actual - 5) / 10) * 10);
  const step = 100 - min > 50 ? 20 : 10;
  const ticks: { value: number; label: string }[] = [];
  for (let v = 100; v >= min; v -= step) ticks.unshift({ value: v, label: `${v}%` });
  return { min, max: 100, ticks };
}

export const GAP_LABEL: Record<GapType, string> = { not_told: "Not told", not_acked: "Not acked", contract_conflict: "Contract conflict", overdue: "Overdue tasks" };
const GAP_NOUN: Record<GapType, [string, string]> = { not_told: ["team", "teams"], not_acked: ["ack", "acks"], contract_conflict: ["contract", "contracts"], overdue: ["task", "tasks"] };
export const gapCount = (gap: GapType, n: number) => plural(n, GAP_NOUN[gap][0], GAP_NOUN[gap][1]);
/** amber = not told, red = conflict, ink for the rest (status colours keep one meaning each). */
export const GAP_TONE: Record<GapType, "gap" | "conflict" | "neutral"> = { not_told: "gap", not_acked: "neutral", contract_conflict: "conflict", overdue: "neutral" };
const GAP_RANK: Record<GapType, number> = { contract_conflict: 0, not_told: 1, not_acked: 2, overdue: 3 };

export type HeatCell = { teamId: string; gap: GapType; count: number; arrAtRisk: number | null; level: 0 | 1 | 2 | 3 };
export type HeatRow = { teamId: string; name: string; cells: (HeatCell | null)[]; total: number };

/**
 * Teams x gap types. Counts add up across a row and down a column; ARR does not: the contract puts each ARR figure
 * on exactly one cell, so it is shown on that cell and never totalled.
 */
export function heatmapGrid(h: A["heatmap"], team: string | null = null) {
  const max = Math.max(1, ...h.cells.map((c) => c.count));
  const at = new Map(h.cells.map((c) => [`${c.teamId}|${c.gap}`, c]));
  const level = (n: number): HeatCell["level"] => (n <= 0 ? 0 : n >= max ? 3 : n / max > 0.5 ? 2 : 1);
  const rows: HeatRow[] = h.teams
    .filter((t) => !team || t.teamId === team)
    .map((t) => {
      const cells = h.columns.map((g) => {
        const c = at.get(`${t.teamId}|${g}`);
        return c && (c.count > 0 || c.arrAtRisk) ? { ...c, level: level(c.count) } : null;
      });
      return { teamId: t.teamId, name: t.name, cells, total: cells.reduce((s, c) => s + (c?.count ?? 0), 0) };
    });
  const columns = h.columns.map((g, i) => ({ gap: g, total: rows.reduce((s, r) => s + (r.cells[i]?.count ?? 0), 0) }));
  return { rows, columns };
}

/** The footer sentence under the heatmap. */
export function heatmapSentence(h: A["heatmap"]): string {
  const name = new Map(h.teams.map((t) => [t.teamId, t.name]));
  const money = h.cells.filter((c) => c.arrAtRisk).sort((a, b) => (b.arrAtRisk ?? 0) - (a.arrAtRisk ?? 0))[0];
  const untold = h.cells.filter((c) => c.gap === "not_told" && c.count > 0).length;
  const parts: string[] = [];
  if (money) parts.push(`${name.get(money.teamId) ?? money.teamId} holds the ${fmtUsd(money.arrAtRisk ?? 0)} of ARR at risk, on a ${GAP_LABEL[money.gap].toLowerCase()}.`);
  if (untold) parts.push(`${plural(untold, "team")} of ${h.teams.length} ${untold === 1 ? "has" : "have"} not been told.`);
  return parts.join(" ") || "No gaps: every affected team is told and acked.";
}

/** Link to the graph section under one team's lens, keeping the decision (?d=) the numbers are about. */
export const graphHref = (a: A, teamId: string | null) => `?${new URLSearchParams({ ...(a.coverage ? { d: a.coverage.caseId } : {}), ...(teamId ? { team: teamId } : {}) })}#graph`;

export type ActCard = { key: string; teamId: string; gap: GapType; title: string; figure: string; figureTone: "conflict" | "gap" | "neutral"; figureNote: string; chip: string | null; dots: number; dotsLabel: string; note: string; action: { label: string; href: string } };

/** "Where to act first": the three cells with the most at stake (ARR, then gap severity, then count), one action each. */
export function actFirst(a: A): ActCard[] {
  const name = new Map(a.heatmap.teams.map((t) => [t.teamId, t.name]));
  const step = new Map((a.waterfall?.steps ?? []).filter((s) => s.teamId).map((s) => [s.teamId as string, s]));
  const wait = new Map(a.timeToTell.rows.map((r) => [r.teamId, r.waitingHours]));
  const caseHref = a.coverage ? `/reports/${a.coverage.caseId}` : "/reports";
  return a.heatmap.cells
    .filter((c) => c.count > 0)
    .sort((x, y) => (y.arrAtRisk ?? 0) - (x.arrAtRisk ?? 0) || GAP_RANK[x.gap] - GAP_RANK[y.gap] || y.count - x.count)
    .slice(0, 3)
    .map((c) => {
      const team = name.get(c.teamId) ?? c.teamId;
      const s = step.get(c.teamId);
      const waited = wait.get(c.teamId);
      const title = { contract_conflict: `Contract conflict in ${team}`, not_told: `${team} has not been told`, not_acked: `${team} has not acked`, overdue: `${gapCount("overdue", c.count)} overdue in ${team}` }[c.gap];
      // coverage points belong to "not told" only (the waterfall steps are the untold teams); other gaps show their count
      const pts = c.gap === "not_told" ? s?.pts : undefined;
      const figure = c.arrAtRisk ? fmtUsd(c.arrAtRisk) : pts ? `${pts} pts` : String(c.count);
      const figureNote = c.arrAtRisk ? "ARR at stake" : pts ? "of coverage at stake" : `${GAP_NOUN[c.gap][c.count === 1 ? 0 : 1]} open`;
      const action = {
        contract_conflict: { label: "Trace it", href: graphHref(a, c.teamId) },
        not_told: { label: `Notify ${team}`, href: caseHref },
        not_acked: { label: `Nudge ${team}`, href: caseHref },
        overdue: { label: `Review ${gapCount("overdue", c.count)}`, href: "/reports" },
      }[c.gap];
      return {
        key: `${c.teamId}|${c.gap}`, teamId: c.teamId, gap: c.gap, title, figure, figureNote,
        figureTone: c.arrAtRisk ? "conflict" : GAP_TONE[c.gap],
        chip: c.gap === "not_told" && waited ? `waiting ${fmtHours(waited)}` : null,
        dots: c.count, dotsLabel: gapCount(c.gap, c.count),
        note: {
          not_told: s?.note ? `${s.note}.` : "Affected by the change and not told yet.",
          contract_conflict: "A contract this team owns conflicts with the change.",
          not_acked: "Told, but has not acknowledged the change yet.",
          overdue: "Tasks past their due date, counted across the org.",
        }[c.gap],
        action,
      };
    });
}

/**
 * Forecast with the toggled scenarios, on top of the current path (so it never reads below it). `approvals` counts only
 * real pending actions (what approving them would do); `ifProposed` adds the toggled derived ones, which are not actions
 * yet. Both are capped at 100.
 */
export function forecastWith(f: { projectedPct: number; scenarios: Scenario[] }, on: ReadonlySet<string>) {
  const sum = (src: Scenario["source"]) => f.scenarios.filter((s) => s.source === src && on.has(s.id)).reduce((t, s) => t + s.pts, 0);
  const approvals = Math.min(100, f.projectedPct + sum("pending"));
  const ifProposed = Math.min(100, approvals + sum("derived"));
  return { approvals, ifProposed, gainPts: approvals - f.projectedPct, proposedPts: ifProposed - approvals };
}

/** Pending actions start on (they exist and wait for you); derived ones start off. */
export const defaultOn = (scenarios: Scenario[]) => new Set(scenarios.filter((s) => s.source === "pending").map((s) => s.id));

/** Label without the API's "(not yet proposed)" suffix; the card shows that as its own tag. */
export const scenarioLabel = (s: Scenario) => s.label.replace(/\s*\(not yet proposed\)\s*$/i, "");

/** Time to tell: one dot per team; told teams at their hours, waiting teams at how long they have waited. */
export function timeDots(t: A["timeToTell"]) {
  const dots = t.rows.map((r) => ({
    id: r.teamId,
    value: r.hours ?? r.waitingHours ?? 0,
    tone: (r.hours !== null ? "covered" : "gap") as "covered" | "gap",
    label: r.hours !== null ? `${r.name}: told in ${fmtHours(r.hours)}` : `${r.name}: still waiting, ${fmtHours(r.waitingHours ?? 0)}`,
  }));
  const max = Math.max(24, ...dots.map((d) => d.value)) * 1.05;
  return { dots, max };
}

export function timeSentence(t: A["timeToTell"]): string {
  const told = t.rows.filter((r) => r.hours !== null);
  const waiting = t.rows.filter((r) => r.hours === null);
  const head = t.medianHours !== null ? `Teams are told in a median ${fmtHours(t.medianHours)}.` : "No team has been told yet.";
  if (!waiting.length) return `${head} All ${told.length} teams have heard.`;
  const longest = Math.max(...waiting.map((r) => r.waitingHours ?? 0));
  return `${head} ${listNames(waiting.map((r) => r.name))} ${waiting.length === 1 ? "has" : "have"} waited ${fmtHours(longest)} and counting.`;
}

export const listNames = (xs: string[]) => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`);

/** Forecast chart points in [0,1] x [0,1] space: x from the first trend day to the effective date, y = pct / 100. */
export function forecastPoints(a: A) {
  const c = a.coverage;
  const f = a.forecast;
  if (!c || !c.trend.length) return null;
  const t0 = c.trend[0].day;
  const today = c.trend[c.trend.length - 1].day;
  // no effective date: the axis ends today and nothing is projected
  const t1 = f?.effectiveAt && f.effectiveAt > today ? f.effectiveAt : today;
  const x = (t: number) => (t1 > t0 ? (t - t0) / (t1 - t0) : 1);
  return { x, t0, today, t1, projected: t1 > today, actual: c.trend.map((p) => [x(p.day), p.pct / 100] as const) };
}
