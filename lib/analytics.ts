// Server side of GET /api/analytics: "Is Ripple closing the loop?" for the focus change. Coverage, the waterfall of what keeps it
// under target, a team x gap heatmap, a forecast with pending-action scenarios, time to tell and agent approval stats.
import { z } from "zod";
import { roQuery } from "./graph/client";
import { decisions, load } from "./graph/queries";
import { loadCase, noticesSent } from "./reports";
import { KIND_TEAM, loadAgentGroups, loadRows, type Group, isCase } from "./reports-db";
import { DEMO_CUSTOMERS_NOTIFIED } from "./reports-demo";
import type { Analytics, Scenario } from "./schemas/analytics";
import type { Context } from "./server/context";
import { names } from "./graph/queries";

const DAY = 86400;
const median = (a: number[]) => (a.length ? [...a].sort((x, y) => x - y)[Math.floor((a.length - 1) / 2)] : null);
const list = (xs: string[]) => (xs.length < 2 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs.at(-1)}`);

/** Demo approval history for an org with no approvals table rows. */
const DEMO_AGENTS: Analytics["agents"] = {
  proposed: 6, approved: 4, rejected: 1, pending: 1, approvalRatePct: 80, medianDecisionHours: 3.5, demo: true,
  byKind: [{ kind: "notice", proposed: 2, approved: 2 }, { kind: "email", proposed: 3, approved: 2 }, { kind: "talk_track", proposed: 1, approved: 0 }],
};

/** Approval stats from org-wide SQL counts (kind x status). `demo` history only when asked for (no Postgres, or the demo org) and nothing is recorded. */
export function agentStats(g: { groups: Group[]; medianHours: number | null } | null, demo: boolean): Analytics["agents"] {
  const groups = g?.groups ?? [];
  const sum = (f: (x: Group) => boolean) => groups.filter(f).reduce((t, x) => t + x.n, 0);
  const proposed = sum(() => true);
  if (!proposed && demo) return DEMO_AGENTS;
  const ok = (x: Group) => x.status === "approved" || x.status === "executed";
  const nA = sum(ok), nR = sum((x) => x.status === "rejected");
  return {
    proposed, approved: nA, rejected: nR, pending: sum((x) => x.status === "pending"),
    approvalRatePct: nA + nR ? Math.round((100 * nA) / (nA + nR)) : null,
    medianDecisionHours: g?.medianHours == null ? null : Math.round(g.medianHours * 10) / 10, demo: false,
    byKind: [...new Set(groups.map((x) => x.kind))].map((kind) => ({ kind, proposed: sum((x) => x.kind === kind), approved: sum((x) => x.kind === kind && ok(x)) })),
  };
}

export async function computeAnalytics(ctx: Context, caseId?: string | null): Promise<Analytics> {
  const { graph: g, now } = ctx;
  const nm = new Map(Object.entries((await names(g)).data));
  const groups = await loadAgentGroups(ctx.org.id);
  const demo = groups === null || ctx.org.isDemo; // seeded numbers only without Postgres or on the demo org
  const agents = agentStats(groups, demo);
  const overdue = new Map(z.array(z.object({ teamId: z.string(), n: z.coerce.number() })).parse(await roQuery(g, load("reports-overdue").text, { now })).map((r) => [r.teamId, r.n]));
  const id = caseId ?? (await decisions(g)).data.filter((d) => d.status !== "superseded").at(-1)?.id;
  const columns: Analytics["heatmap"]["columns"] = ["not_told", "not_acked", "contract_conflict", "overdue"];
  if (!id) return { now, coverage: null, waterfall: null, forecast: null, heatmap: { overdueScope: "org", teams: [], columns, cells: [] }, timeToTell: { rows: [], medianHours: null }, agents };

  const c = await loadCase(g, id, now, nm);
  const rows = await loadRows(ctx.org.id, id);
  const { row, rip, head, toldAt } = c;
  const { affected, told, pct } = row.coverage;
  const teamName = (t: string) => nm.get(t) ?? t;

  // coverage per day since the announcement (affected teams whose own edge is dated by that day's end)
  const pctAt = (t: number) => (affected ? Math.round((100 * rip.teams.filter((x) => (toldAt.get(x.teamId) ?? Infinity) <= t).length) / affected) : 100);
  // the full span from the announcement to now; one point per day, or per `step` days past 60 so a long span never jumps
  const span = Math.max(1, Math.ceil((now - head.decidedAt) / DAY));
  const step = Math.ceil(span / 60);
  const trend = Array.from({ length: Math.ceil(span / step) + 1 }, (_, i) => {
    const last = i === Math.ceil(span / step);
    const day = last ? now : head.decidedAt + i * step * DAY;
    return { day, pct: last ? pct : pctAt(Math.min(now, day + step * DAY - 1)), today: last };
  });
  const sentReal = noticesSent(rows, id);
  const demoCust = demo && sentReal === 0 && id === "d-1";

  // waterfall: each untold team costs an equal share of the target; ARR rides on the team that manages the conflicting contracts
  const loss = 100 - pct;
  const share = affected ? Math.floor(100 / affected) : 0;
  const steps = rip.gap.map((t, i) => ({
    id: t, label: `${teamName(t)} not told`, teamId: t, teams: 1,
    pts: i === 0 ? loss - share * (rip.gap.length - 1) : share,
    arrAtRisk: t === "legal" && rip.counts.conflicts ? rip.counts.arrAtRisk : null, // ponytail: only the contract owner carries ARR; per-team attribution needs a customer-to-team map
    note: `${teamName(t)} ${rip.teams.find((x) => x.teamId === t)?.why[0]?.reason ?? "is affected"}${t === "legal" && rip.counts.conflicts ? `, behind ${rip.counts.conflicts} open contract conflict` : ""}`,
  }));
  steps.sort((x, y) => y.pts - x.pts || Number(y.arrAtRisk !== null) - Number(x.arrAtRisk !== null) || x.id.localeCompare(y.id)); // biggest first; ties: the one carrying ARR, then by id
  const top = steps.slice(0, 2);
  const topPts = top.reduce((t, x) => t + x.pts, 0);
  const takeaway = steps.length ? `${list(top.map((x) => teamName(x.teamId!)))} ${top.length > 1 ? "explain" : "explains"} ${Math.round((100 * topPts) / loss)}% of the ${loss} point gap.` : "Every affected team has been told.";

  // heatmap
  const cells: Analytics["heatmap"]["cells"] = [];
  for (const t of rip.teams) {
    const add = (gap: Analytics["heatmap"]["columns"][number], count: number, arr: number | null = null) => count > 0 && cells.push({ teamId: t.teamId, gap, count, arrAtRisk: arr });
    const conflict = t.teamId === "legal" ? rip.counts.conflicts : 0;
    add("not_told", rip.gap.includes(t.teamId) ? 1 : 0);
    add("not_acked", t.involved && !t.acked ? 1 : 0);
    add("contract_conflict", conflict, rip.counts.arrAtRisk);
    add("overdue", overdue.get(t.teamId) ?? 0);
  }

  // forecast: pace = teams told in the last 14 days; with approvals = the current path plus every pending action (never below it); scenarios = pending agent actions that would tell a still-untold team
  const eff = head.effectiveAt;
  const daysLeft = eff ? Math.max(0, Math.ceil((eff - now) / DAY)) : null;
  const recent = [...toldAt.entries()].filter(([t, at]) => rip.teams.some((x) => x.teamId === t) && at >= now - 14 * DAY).length;
  const projectedPct = Math.min(100, pct + (daysLeft && affected ? Math.round((recent / 14) * daysLeft * (100 / affected)) : 0));
  const pts = affected ? Math.floor(100 / affected) : 0;
  const pending = (rows?.pending ?? []).filter((p) => p.status === "pending" && isCase(id, p) && rip.gap.includes(KIND_TEAM[p.kind] ?? ""));
  const scenarios: Scenario[] = rip.gap.map((t) => {
    const p = pending.find((x) => KIND_TEAM[x.kind] === t);
    return { id: `tell-${t}`, label: p ? `Notify ${teamName(t)}` : `Notify ${teamName(t)} (not yet proposed)`, teamId: t, pts, source: p ? ("pending" as const) : ("derived" as const), actionId: p?.id ?? null };
  });

  // time to tell
  const ttt = rip.teams.map((t) => {
    const at = toldAt.get(t.teamId) ?? null;
    return { teamId: t.teamId, name: teamName(t.teamId), hours: at === null ? null : Math.max(0, Math.round((at - head.decidedAt) / 3600)), toldAt: at, waitingHours: at === null ? Math.max(0, Math.round((now - head.decidedAt) / 3600)) : null };
  });

  return {
    now,
    coverage: {
      caseId: id, title: head.title, pct, targetPct: 100,
      deltaPts: pct - pctAt(now - DAY), teams: { told, affected },
      acks: { done: rip.teams.filter((t) => t.acked).length, of: affected },
      notices: { sent: sentReal || (demoCust ? DEMO_CUSTOMERS_NOTIFIED : 0), of: rip.counts.customers, demo: demoCust },
      trend,
    },
    waterfall: { targetPct: 100, steps, actualPct: pct, takeaway },
    heatmap: { overdueScope: "org", teams: rip.teams.map((t) => ({ teamId: t.teamId, name: teamName(t.teamId) })), columns, cells },
    forecast: { effectiveAt: eff, daysLeft, currentPct: pct, projectedPct, withApprovalsPct: Math.min(100, projectedPct + scenarios.filter((x) => x.source === "pending").reduce((s, x) => s + x.pts, 0)), scenarios },
    timeToTell: { rows: ttt, medianHours: median(ttt.flatMap((r) => (r.hours === null ? [] : [r.hours]))) },
    agents,
  };
}
