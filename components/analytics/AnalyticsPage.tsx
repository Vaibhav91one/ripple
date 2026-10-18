"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { parseAsString, parseAsStringLiteral, useQueryState } from "nuqs";
import { useEffect, useState } from "react";
import { ChevronRight, Code2, CircleAlert, CircleCheck, Clock, FileWarning, Scale, Send, Users, type LucideIcon } from "lucide-react";
import { DateRange, ExportButton, PageHeader } from "@/components/shell/PageHeader";
import { GraphPage } from "@/components/graph/GraphPage";
import { getGraph } from "@/components/graph/api";
import { useKinds } from "@/components/graph/GraphToolbar";
import CodeBlock from "@/components/kit/beautifului/code-block";
import { TEAM_TABS, useTeam } from "@/components/ripple/useTeam";
import { Card, CardHeader, Takeaway } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { DotStrip } from "@/components/ui/dot-strip";
import { hatch } from "@/components/ui/hatch";
import { HatchedBar, PlanLegend } from "@/components/ui/hatched-bar";
import { DeltaChip, HeroNumber } from "@/components/ui/hero-number";
import { InsightCard } from "@/components/ui/insight-card";
import { NeedsYou as NeedsYouCard, type NeedsYouRow } from "@/components/ui/needs-you";
import { StatusPill } from "@/components/ui/status-pill";
import { TargetBar } from "@/components/ui/target-bar";
import { Waterfall } from "@/components/ui/waterfall";
import { WeeklyBars } from "@/components/ui/weekly-bars";
import type { Analytics, Scenario } from "@/lib/schemas/analytics";
import { getAnalytics } from "./api";
import { ForecastChart } from "./ForecastChart";
import {
  GAP_LABEL, GAP_TONE, actFirst, coverageSentence, defaultOn, exposedArr, fmtDay, fmtHours, fmtUsd, forecastWith, gapCount, heatmapGrid,
  graphHref, heatmapSentence, listNames, plural, scenarioLabel, stepText, timeDots, timeSentence, waterfallAxis,
} from "./model";

const TABS = ["overview", "team", "customer", "system", "agent"] as const;
const TAB_LABEL: Record<(typeof TABS)[number], string> = { overview: "Overview", team: "By team", customer: "By customer", system: "By system", agent: "By agent" };

/** A subtle marker on numbers that come from seeded demo history, not the live graph or database. */
function Demo() {
  return <span className="ml-2 inline-flex h-5 items-center rounded-full border border-dashed border-hairline px-2 align-middle text-2xs font-normal tracking-normal text-faint" title="Seeded demo history: there is no database for this yet">demo data</span>;
}

/** /analytics: Is Ripple closing the loop? Coverage, where it leaks, the forecast, and the graph that computes all of it. */
export function AnalyticsPage() {
  const [team, setTeam] = useTeam();
  const [tab, setTab] = useQueryState("view", parseAsStringLiteral(TABS).withDefault("overview"));
  // ?d= is the one decision for the numbers and the graph; without it the API picks the focus change, and we pin that
  // into ?d= so the embedded graph (which reads ?d=) shows the same change
  const [d, setD] = useQueryState("d", parseAsString);
  const { data: a, error, refetch } = useQuery({ queryKey: ["analytics", d], queryFn: () => getAnalytics(d) });
  const caseId = a?.coverage?.caseId ?? null;
  useEffect(() => {
    if (!d && caseId) void setD(caseId);
  }, [d, caseId, setD]);
  const start = a?.coverage?.trend[0]?.day;

  return (
    <>
      <PageHeader title="Analytics" subtitle="Is Ripple closing the loop?">
        <DateRange label={start ? `${fmtDay(start)} to today` : "Since announced"} compare="yesterday" />
        <label className="relative inline-flex h-11 lg:h-10 items-center gap-2 rounded-control bg-raised px-3.5 text-sm font-medium text-strong hover:bg-hairline">
          <Users size={15} aria-hidden className="text-body" />
          <select aria-label="Team" value={team ?? ""} onChange={(e) => void setTeam((e.target.value || null) as typeof team)} className="appearance-none bg-transparent pr-1 outline-none">
            <option value="">All teams</option>
            {TEAM_TABS.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
        </label>
        <ExportButton href="/api/analytics" />
      </PageHeader>

      <nav aria-label="Analytics views" className="-mx-1 mb-5 flex gap-1 overflow-x-auto px-1">
        {TABS.map((t) => (
          <button key={t} type="button" aria-pressed={tab === t} onClick={() => void setTab(t === "overview" ? null : t)}
            className={`h-9 shrink-0 rounded-full px-4 text-sm font-medium transition-colors ${tab === t ? "bg-strong text-ink-on-strong" : "text-body hover:bg-raised"}`}>
            {TAB_LABEL[t]}
          </button>
        ))}
      </nav>

      {error ? (
        <Card><p className="text-sm text-conflict">Could not load analytics: {error.message}. <button className="underline" onClick={() => void refetch()}>Retry</button></p></Card>
      ) : !a ? (
        <div className="grid gap-4 lg:grid-cols-3" aria-busy="true" aria-label="Loading analytics">
          {[0, 1, 2].map((i) => <div key={i} className="h-[560px] animate-pulse rounded-card bg-surface" />)}
        </div>
      ) : (
        <>
          {tab === "overview" && <Overview a={a} team={team} />}
          {tab === "team" && <ByTeam a={a} team={team} />}
          {tab === "customer" && <ByCustomer a={a} team={team} />}
          {tab === "system" && <BySystem a={a} team={team} />}
          {tab === "agent" && <AgentCard a={a} wide />}
        </>
      )}

      {caseId && <GraphSection d={caseId} />}
    </>
  );
}

/** The existing graph explorer, with the Cypher it ran docked beside it (below on phones) instead of over the canvas. */
function GraphSection({ d }: { d: string }) {
  const [team] = useTeam();
  const [kinds] = useKinds();
  const { data } = useQuery({ queryKey: ["graph", d, team, kinds.join()], queryFn: () => getGraph(d, { team, kinds }) });
  const [i, setI] = useState(0);
  const q = data?.cypher[Math.min(i, data.cypher.length - 1)];
  return (
    <section id="graph" className="mt-4 scroll-mt-6">
      <Card className="overflow-hidden !p-0">
        <div className="p-6 pb-4">
          <CardHeader title="The graph behind these numbers" sub="Every figure above comes from Cypher over the company graph in FalkorDB. Click a node to see what it touches; Escape closes it." />
        </div>
        <div className="grid border-t border-hairline lg:grid-cols-[1fr_380px]">
          <div className="h-[560px] sm:h-[640px]"><GraphPage /></div>
          <aside aria-label="Cypher used" className="min-w-0 border-t border-hairline p-5 lg:border-l lg:border-t-0">
            <h3 className="flex items-center gap-2 text-md font-medium text-strong"><Code2 size={16} aria-hidden /> Cypher used</h3>
            <p className="mt-1 text-sm text-faint">{data ? `${plural(data.cypher.length, "query", "queries")} built this view, run as written.` : "Loading the queries…"}</p>
            {data && q && (
              <>
                <div className="mt-4 flex flex-wrap gap-1">
                  {data.cypher.map((c, k) => (
                    <button key={c.name} type="button" onClick={() => setI(k)} aria-pressed={c.name === q.name}
                      className={`h-7 rounded-full px-2.5 font-mono text-xs transition-colors ${c.name === q.name ? "bg-strong text-ink-on-strong" : "bg-raised text-body hover:text-strong"}`}>{c.name}</button>
                  ))}
                </div>
                <div className="mt-3 overflow-x-auto"><CodeBlock key={q.name} code={q.text} language="Cypher" title={`${q.name}.cypher`} stream={false} className="max-w-none" /></div>
              </>
            )}
          </aside>
        </div>
      </Card>
    </section>
  );
}

function Overview({ a, team }: { a: Analytics; team: string | null }) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 *:min-w-0 lg:grid-cols-[1fr_1.1fr_1fr]">
        <div className="flex flex-col gap-4"><CoverageCard a={a} /><TrendCard a={a} /></div>
        <WhyCard a={a} />
        <div className="flex flex-col gap-4"><Insight a={a} /><NeedsYou a={a} /></div>
      </div>
      <h2 id="leakage" className="scroll-mt-6 pt-6 text-2xl font-normal tracking-tight text-strong">Leakage</h2>
      <HeatmapCard a={a} team={team} />
      <ActFirst a={a} />
      <h2 id="forecast" className="scroll-mt-6 pt-6 text-2xl font-normal tracking-tight text-strong">Forecast</h2>
      <ForecastSection key={(a.forecast?.scenarios ?? []).map((x) => x.id).join()} a={a} />
      <div className="grid gap-4 *:min-w-0 lg:grid-cols-2"><TimeToTell a={a} /><AgentCard a={a} /></div>
    </div>
  );
}

function CoverageCard({ a }: { a: Analytics }) {
  const c = a.coverage;
  if (!c) return <Card><CardHeader title="Coverage" sub="No open change" /><p className="mt-6 text-sm text-faint">Announce a change and Ripple will measure who heard about it.</p></Card>;
  const due = a.forecast?.effectiveAt && !c.title.includes(fmtDay(a.forecast.effectiveAt)) ? ` · due ${fmtDay(a.forecast.effectiveAt)}` : "";
  const d = c.deltaPts;
  return (
    <Card>
      <CardHeader title="Coverage" sub={`${c.title}${due}`} />
      <div className="mt-5">
        <HeroNumber value={`${c.pct}%`} delta={{ value: `${Math.abs(d)} pts`, dir: d < 0 ? "down" : "up", tone: d > 0 ? "good" : d < 0 ? "bad" : "neutral", vs: "vs yesterday" }}>
          {coverageSentence(a)}
        </HeroNumber>
      </div>
      <div className="mt-6"><TargetBar value={c.pct} target={100} from="0%" targetLabel="Target 100%" tone="ripple" label={`Coverage ${c.pct}% of target 100%`} /></div>
      <dl className="mt-5 divide-y divide-hairline text-md">
        <Row k="Teams told" v={`${c.teams.told} of ${c.teams.affected}`} />
        <Row k="Acks" v={`${c.acks.done} of ${c.acks.of}`} />
        <Row k="Notices sent" v={<>{c.notices.sent} of {c.notices.of}{c.notices.demo && <Demo />}</>} />
        <Row k="ARR exposed" v={(() => { const arr = exposedArr(a); return arr === null ? "–" : fmtUsd(arr); })()} />
      </dl>
    </Card>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return <div className="flex items-center justify-between gap-3 py-3"><dt className="text-faint">{k}</dt><dd className="font-medium tabular-nums text-strong">{v}</dd></div>;
}

function TrendCard({ a }: { a: Analytics }) {
  const t = a.coverage?.trend.slice(-12) ?? [];
  if (t.length < 2) return null;
  return <WeeklyBars title="Last 12 days" caption="Coverage by day" values={t.map((p) => p.pct)} min={0} max={100} target={{ value: 100, label: "Target 100%" }} lastLabel={`${t[t.length - 1].pct}`} xLabels={[fmtDay(t[0].day), "Today"]} />;
}

function WhyCard({ a }: { a: Analytics }) {
  const w = a.waterfall;
  if (!w || !w.steps.length) return <Card><CardHeader title="Why coverage is under target" sub="Nothing lost: every affected team is told" /></Card>;
  const lost = 100 - w.actualPct;
  const top = [...w.steps].sort((x, y) => (y.arrAtRisk ?? 0) - (x.arrAtRisk ?? 0))[0];
  return (
    <Waterfall
      title="Why coverage is under target" subtitle={`${lost} points lost against the 100% target`} link="Graph" href="#graph" stepColor="var(--gap)"
      axis={waterfallAxis(w.actualPct)}
      target={{ label: "Target", text: "100%", value: 100 }}
      steps={w.steps.map((s) => ({ label: s.label, text: stepText(s.pts, s.arrAtRisk), delta: s.pts }))}
      actual={{ label: "Actual", text: `${w.actualPct}%`, value: w.actualPct }}
      note={{ lead: w.takeaway, sub: top?.note ? `${top.note}.` : "Each step is a team the graph says the change reaches." }}
    />
  );
}

/** The page's one gradient card: the step with the most ARR behind it. */
function Insight({ a }: { a: Analytics }) {
  const steps = a.waterfall?.steps ?? [];
  const s = [...steps].sort((x, y) => (y.arrAtRisk ?? 0) - (x.arrAtRisk ?? 0) || y.pts - x.pts)[0];
  if (!s) return <InsightCard headline="Every affected team has been told" body="Ripple keeps watching for new edges in the graph." />;
  const team = a.heatmap.teams.find((t) => t.teamId === s.teamId)?.name ?? s.label;
  const conflict = a.heatmap.cells.some((c) => c.teamId === s.teamId && c.gap === "contract_conflict");
  return (
    <InsightCard
      tag="Ripple noticed" counter={`1 of ${steps.length}`}
      figure={s.arrAtRisk ? fmtUsd(s.arrAtRisk) : `${s.pts} pts`} figureNote={s.arrAtRisk ? "of ARR behind a team that has not heard" : "of coverage behind one team"}
      headline={conflict ? `${team} holds the contract conflict and has not been told` : `${team} has not been told`}
      body={`${s.note}. The graph found it ${conflict ? "through the contracts that guarantee the system" : "through who owns the system"}.`}
      action={{ label: "Trace it in the graph", href: graphHref(a, s.teamId) }}
    />
  );
}

function NeedsYou({ a }: { a: Analytics }) {
  const name = new Map(a.heatmap.teams.map((t) => [t.teamId, t.name]));
  const untold = a.timeToTell.rows.filter((r) => r.hours === null);
  const conflicts = a.heatmap.cells.filter((c) => c.gap === "contract_conflict" && c.count > 0);
  const overdue = a.heatmap.cells.filter((c) => c.gap === "overdue" && c.count > 0);
  const caseHref = a.coverage ? `/reports/${a.coverage.caseId}` : "/reports";
  const rows: NeedsYouRow[] = [];
  if (untold.length) {
    const longest = [...untold].sort((x, y) => (y.waitingHours ?? 0) - (x.waitingHours ?? 0))[0];
    rows.push({ id: "untold", icon: Send, tone: "gap", title: `${plural(untold.length, "team")} not told`, sub: `${longest.name} has waited ${fmtHours(longest.waitingHours ?? 0)}`, href: caseHref });
  }
  for (const c of conflicts) rows.push({ id: `c-${c.teamId}`, icon: Scale, tone: "conflict", title: `${plural(c.count, "contract conflict")}`, sub: `${name.get(c.teamId) ?? c.teamId}${c.arrAtRisk ? ` · ${fmtUsd(c.arrAtRisk)} ARR` : ""}`, href: graphHref(a, c.teamId) });
  // agents.pending is org-wide (not this change), and seeded history when agents.demo
  if (a.agents.pending) rows.push({ id: "approvals", icon: CircleCheck, tone: "ripple", title: `${plural(a.agents.pending, "approval")} waiting org-wide`, sub: a.agents.demo ? "Demo data: seeded agent history" : "Drafted by the agents, waiting for your OK", href: "/reports" });
  const od = overdue.reduce((s, c) => s + c.count, 0);
  if (od) rows.push({ id: "overdue", icon: Clock, tone: "neutral", title: `${plural(od, "task")} overdue`, sub: `Org-wide · ${listNames(overdue.map((c) => name.get(c.teamId) ?? c.teamId))}`, href: "/reports" });
  return <NeedsYouCard id="needs-you" rows={rows} sub={`${plural(rows.length, "thing")} on this change`} empty="Nothing needs you on this change." />;
}

const LEVEL = [0, 18, 34, 56];
function HeatmapCard({ a, team }: { a: Analytics; team: string | null }) {
  const { rows, columns } = heatmapGrid(a.heatmap, team);
  return (
    <Card>
      <CardHeader title="Where it leaks" sub="By team and gap type, for this change. ARR sits on the one cell it belongs to." />
      <div className="mt-5 overflow-x-auto">
        <table className="w-full min-w-[560px] table-fixed border-separate border-spacing-1.5 text-sm">
          <caption className="sr-only">Gaps by team and gap type</caption>
          <thead>
            <tr>
              <th className="w-24" />
              {columns.map((c) => (
                <th key={c.gap} scope="col" className="px-1 pb-1 text-left font-normal">
                  <span className="block text-xs text-faint">{GAP_LABEL[c.gap]}{c.gap === "overdue" && " (org)"}</span>
                  <span className="block font-medium tabular-nums text-strong">{gapCount(c.gap, c.total)}</span>
                </th>
              ))}
              <th scope="col" className="w-16 pb-1 text-right text-xs font-normal text-faint" title="Includes org-wide overdue tasks">Total<span className="sr-only"> (includes org-wide overdue tasks)</span></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.teamId}>
                <th scope="row" className="pr-2 text-left font-medium text-strong">{r.name}</th>
                {r.cells.map((c, i) => {
                  const tone = GAP_TONE[columns[i].gap];
                  const color = tone === "neutral" ? "var(--strong)" : `var(--${tone})`;
                  return (
                    <td key={columns[i].gap} className="h-14 rounded-inset text-center tabular-nums"
                      style={c ? { background: `color-mix(in srgb, ${color} ${LEVEL[c.level] * (tone === "neutral" ? 0.5 : 1)}%, var(--surface))` } : { background: "color-mix(in srgb, var(--raised) 60%, transparent)" }}>
                      {c ? (
                        <span className={`font-medium ${c.level === 3 && tone === "conflict" ? "text-ink-on-strong" : "text-strong"}`}>
                          {c.arrAtRisk ? fmtUsd(c.arrAtRisk) : c.count}
                          {c.arrAtRisk ? <span className="block text-2xs font-normal opacity-80">{gapCount(c.gap, c.count)}</span> : null}
                        </span>
                      ) : <span className="text-faint"><span aria-hidden>·</span><span className="sr-only">none</span></span>}
                    </td>
                  );
                })}
                <td className="pl-2 text-right tabular-nums text-strong">{r.total || "·"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-4 text-sm text-faint">{heatmapSentence(a.heatmap)}</p>
    </Card>
  );
}

const ACT_ICON: Record<string, LucideIcon> = { contract_conflict: Scale, not_told: Send, not_acked: CircleAlert, overdue: FileWarning };
const TINT = { conflict: "bg-conflict-soft text-conflict", gap: "bg-gap-soft text-gap", neutral: "bg-raised text-body" } as const;
const INK = { conflict: "text-conflict", gap: "text-gap", neutral: "text-strong" } as const;
const DOT = { conflict: "bg-conflict/70", gap: "bg-gap/70", neutral: "bg-faint/60" } as const;

function ActFirst({ a }: { a: Analytics }) {
  const cards = actFirst(a);
  if (!cards.length) return null;
  return (
    <Card>
      <CardHeader title="Where to act first" sub={`The ${cards.length === 1 ? "gap" : `${cards.length} gaps`} with the most at stake`} />
      <ol className="mt-5 grid gap-6 md:grid-cols-3 md:gap-0 md:divide-x md:divide-hairline">
        {cards.map((c, i) => {
          const Icon = ACT_ICON[c.gap];
          const tone = GAP_TONE[c.gap];
          return (
            <li key={c.key} className="flex flex-col md:px-6 md:first:pl-0 md:last:pr-0">
              <p className="flex items-center gap-2 text-sm text-faint"><span className={`grid size-8 place-items-center rounded-full ${TINT[tone]}`}><Icon size={15} aria-hidden /></span>{i + 1}</p>
              <h3 className="mt-4 text-lg font-medium text-strong">{c.title}</h3>
              <p className="mt-2 flex items-baseline gap-2"><span className={`text-3xl font-light tracking-[-0.03em] tabular-nums ${INK[c.figureTone]}`}>{c.figure}</span><span className="text-sm text-faint">{c.figureNote}</span></p>
              {c.chip && <p className="mt-3"><span className="inline-flex h-7 items-center rounded-full border border-hairline bg-surface px-2.5 text-sm font-medium text-strong">{c.chip}</span><span className="ml-2 text-sm text-faint">since the announcement</span></p>}
              <p className="mt-3 flex items-center gap-2 text-sm text-faint">
                <span className="flex flex-wrap gap-1" aria-hidden>{Array.from({ length: Math.min(c.dots, 24) }, (_, k) => <span key={k} className={`size-2 rounded-full ${DOT[tone]}`} />)}</span>
                {c.dotsLabel}
              </p>
              <p className="mt-3 text-sm leading-relaxed text-body">{c.note}</p>
              <Link href={c.action.href} className={`mt-5 inline-flex h-10 w-fit items-center gap-1 rounded-control px-4 text-sm font-medium md:mt-auto ${i === 0 ? "bg-strong text-ink-on-strong hover:bg-body" : "bg-raised text-strong hover:bg-hairline"}`}>
                {c.action.label}{i === 0 && <ChevronRight size={15} aria-hidden />}
              </Link>
            </li>
          );
        })}
      </ol>
    </Card>
  );
}

function ForecastSection({ a }: { a: Analytics }) {
  const f = a.forecast;
  const [on, setOn] = useState<Set<string>>(() => defaultOn(f?.scenarios ?? []));
  if (!f) return <Card><CardHeader title="Forecast" sub="No effective date on this change, so there is nothing to forecast to." /></Card>;
  const w = forecastWith(f, on);
  const due = f.effectiveAt ? fmtDay(f.effectiveAt) : "the effective date";
  const gap = 100 - f.projectedPct;
  const toggle = (s: Scenario) => setOn((cur) => { const n = new Set(cur); if (n.has(s.id)) n.delete(s.id); else n.add(s.id); return n; });
  const pending = f.scenarios.filter((s) => s.source === "pending").length;
  return (
    <div className="space-y-4">
      <Card className="grid grid-cols-2 gap-5 lg:grid-cols-4 lg:gap-0 lg:divide-x lg:divide-hairline">
        {f.effectiveAt ? (
          <>
            <Kpi label={`Projected coverage on ${due}`} value={`${f.projectedPct}%`} sub={`At the pace so far · ${f.daysLeft ?? 0} days left`} />
            <Kpi label="Today" value={`${f.currentPct}%`} sub={`${f.projectedPct - f.currentPct} more pts expected by ${due}`} />
            <Kpi label="Gap to target" value={`${gap} pts`} tone={gap ? "text-gap" : undefined} sub={gap ? `Short of 100% on ${due} at this pace` : "On track for every team"} />
            <Kpi label="With your approvals" value={`${w.approvals}%`} tone={w.gainPts ? "text-covered" : undefined}
              chip={w.gainPts ? `${w.gainPts} pts` : undefined}
              sub={pending ? `${plural(pending, "pending action")} on top of the current path` : "No agent action is pending, so it matches the current path"} />
          </>
        ) : (
          <>
            <Kpi label="Projected coverage" value="–" sub="No effective date set" />
            <Kpi label="Today" value={`${f.currentPct}%`} sub="Nothing to project to without a date" />
            <Kpi label="Gap to target" value={`${100 - f.currentPct} pts`} tone={f.currentPct < 100 ? "text-gap" : undefined} sub="Short of 100% today" />
            <Kpi label="With your approvals" value="–" sub="No effective date set" />
          </>
        )}
      </Card>
      <Card>
        <CardHeader title="Coverage outlook" sub={`Actual so far, then the path to ${due}`} action={<Legend proposed={w.proposedPts > 0} />} />
        <ForecastChart a={a} approvals={w.approvals} ifProposed={w.ifProposed} />
        {w.proposedPts > 0 && <p className="mt-3 text-sm text-faint">The dotted line adds {w.proposedPts} pts from notices nobody has proposed yet. Ask the assistant to draft them, then approve.</p>}
      </Card>
      <div className={`grid gap-4 sm:grid-cols-2 ${f.scenarios.length === 3 ? "lg:grid-cols-3" : "lg:grid-cols-4"}`}>
        {f.scenarios.map((s) => {
          const active = on.has(s.id);
          const derived = s.source === "derived";
          return (
            <button key={s.id} type="button" role="switch" aria-checked={active} onClick={() => toggle(s)}
              className={`flex flex-col rounded-card border bg-surface p-5 text-left transition-colors ${active ? (derived ? "border-strong" : "border-covered") : "border-hairline hover:border-faint"}`}>
              <span className="flex w-full items-center justify-between">
                <span className={`grid size-9 place-items-center rounded-full ${derived ? "bg-raised text-body" : "bg-covered-soft text-covered"}`}><Send size={15} aria-hidden /></span>
                <span aria-hidden className={`flex h-5 w-9 items-center rounded-full p-0.5 transition-colors ${active ? (derived ? "bg-strong" : "bg-covered") : "bg-hairline"}`}>
                  <span className={`size-4 rounded-full bg-surface shadow-sm transition-transform ${active ? "translate-x-4" : ""}`} />
                </span>
              </span>
              <span className="mt-4 text-md font-medium text-strong">{scenarioLabel(s)}</span>
              <span className="mt-1 flex items-baseline gap-2"><span className={`text-3xl font-light tabular-nums ${active && !derived ? "text-covered" : "text-strong"}`}>+{s.pts} pts</span><span className="text-sm text-faint">of coverage</span></span>
              <span className="mt-3 h-1.5 w-full rounded-full bg-raised"><span className="block h-full rounded-full" style={{ width: `${s.pts}%`, ...(active && !derived ? { background: "var(--covered)" } : hatch("var(--faint)")) }} /></span>
              <span className="mt-3 text-sm text-faint">{derived ? <><StatusPill tone="neutral">not yet proposed</StatusPill><span className="ml-2">What telling this team is worth</span></> : "A pending action: approving it sends the notice"}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Kpi({ label, value, sub, tone, chip }: { label: string; value: string; sub: string; tone?: string; chip?: string }) {
  return (
    <div className="lg:px-6 lg:first:pl-0 lg:last:pr-0">
      <p className="text-sm text-faint">{label}</p>
      <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1"><span className={`text-3xl font-light tracking-[-0.03em] tabular-nums sm:text-4xl ${tone ?? "text-strong"}`}>{value}</span>{chip && <DeltaChip value={chip} dir="up" tone="good" />}</p>
      <p className="mt-2 text-sm text-faint">{sub}</p>
    </div>
  );
}

function Legend({ proposed }: { proposed: boolean }) {
  const item = (cls: string, label: string) => <span className="inline-flex items-center gap-1.5"><span className={`w-4 border-t-2 ${cls}`} />{label}</span>;
  return (
    <p className="hidden flex-wrap items-center justify-end gap-x-4 gap-y-1 text-xs text-faint md:flex">
      {item("border-ripple", "Actual")}{item("border-dashed border-ripple", "Current path")}{item("border-dashed border-covered", "With approvals")}{proposed && item("border-dotted border-faint", "If proposed")}
    </p>
  );
}

function TimeToTell({ a }: { a: Analytics }) {
  const t = a.timeToTell;
  if (!t.rows.length) return null;
  const { dots, max } = timeDots(t);
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((p) => ({ value: p * max, label: fmtHours(p * max) }));
  return (
    <Card>
      <CardHeader title="Time to tell" sub="One dot per affected team · green told, amber still waiting" />
      <div className="mt-8">
        <DotStrip dots={dots} min={0} max={max} cols={40} marker={t.medianHours !== null ? { value: t.medianHours, label: `Median ${fmtHours(t.medianHours)}` } : undefined} ticks={ticks} label="Hours from announcement to each team told" />
      </div>
      <div className="mt-6"><Takeaway lead={timeSentence(t)} sub={listNames(t.rows.filter((r) => r.hours !== null).map((r) => `${r.name} in ${fmtHours(r.hours ?? 0)}`)) || undefined} /></div>
    </Card>
  );
}

function AgentCard({ a, wide = false }: { a: Analytics; wide?: boolean }) {
  const g = a.agents;
  const decided = g.approved + g.rejected;
  return (
    <Card>
      <CardHeader title={<>Agent approvals{g.demo && <Demo />}</>} sub="What the agents proposed and what you decided" action={<PlanLegend plan="Proposed" actual="Approved" over="Over" />} />
      <div className={`mt-5 grid grid-cols-2 gap-4 ${wide ? "md:grid-cols-4" : ""}`}>
        <Mini label="Approval rate" value={g.approvalRatePct === null ? "–" : `${g.approvalRatePct}%`} sub={`${g.approved} of ${decided} decided`} />
        <Mini label="Median decision" value={g.medianDecisionHours === null ? "–" : `${g.medianDecisionHours} h`} sub="From proposal to your OK" />
        <Mini label="Proposed" value={String(g.proposed)} sub={`${g.rejected} rejected`} />
        <Mini label="Waiting" value={String(g.pending)} sub={g.pending ? "In Approvals" : "Nothing waiting"} />
      </div>
      <ul className="mt-5 divide-y divide-hairline">
        {g.byKind.map((k) => (
          <li key={k.kind} className="grid grid-cols-[6.5rem_1fr_4rem] items-center gap-4 py-3 text-md">
            <span className="capitalize text-strong">{k.kind.replace("_", " ")}</span>
            <HatchedBar plan={k.proposed} actual={k.approved} max={Math.max(...g.byKind.map((x) => x.proposed), 1)} label={`${k.kind}: ${k.approved} of ${k.proposed} approved`} />
            <span className="text-right text-sm text-faint">{k.approved} of {k.proposed}</span>
          </li>
        ))}
      </ul>
      {g.approvalRatePct !== null && <div className="mt-5"><Takeaway lead={`You approved ${g.approvalRatePct}% of what the agents proposed.`} sub={worstKind(g)} /></div>}
    </Card>
  );
}

const worstKind = (g: Analytics["agents"]) => {
  const k = [...g.byKind].filter((x) => x.proposed).sort((x, y) => x.approved / x.proposed - y.approved / y.proposed)[0];
  return k && k.approved < k.proposed ? `Rejections cluster on ${k.kind.replace("_", " ")}s: ${k.approved} of ${k.proposed} approved.` : undefined;
};

function Mini({ label, value, sub }: { label: string; value: string; sub: string }) {
  return <div className="rounded-inset bg-raised/50 p-4"><p className="text-xs text-faint">{label}</p><p className="mt-1 text-2xl font-light tabular-nums text-strong">{value}</p><p className="mt-1 text-xs text-faint">{sub}</p></div>;
}

function ByTeam({ a, team }: { a: Analytics; team: string | null }) {
  const { rows, columns } = heatmapGrid(a.heatmap, team);
  const tt = new Map(a.timeToTell.rows.map((r) => [r.teamId, r]));
  const step = new Map((a.waterfall?.steps ?? []).map((s) => [s.teamId, s]));
  return (
    <Card>
      <CardHeader title="By team" sub={`${plural(rows.length, "team")} the change reaches, least covered first`} />
      <div className="mt-4">
        <DataTable caption="Teams" rows={[...rows].sort((x, y) => y.total - x.total)} rowKey={(r) => r.teamId}
          columns={[
            { key: "t", header: "Team", render: (r) => <span className="font-medium">{r.name}</span> },
            { key: "s", header: "Status", render: (r) => { const x = tt.get(r.teamId); return x?.hours != null ? <StatusPill tone="covered">Told in {fmtHours(x.hours)}</StatusPill> : x ? <StatusPill tone="gap">Waiting {fmtHours(x.waitingHours ?? 0)}</StatusPill> : <StatusPill tone="neutral">Not on this change</StatusPill>; } },
            { key: "g", header: "Gaps", render: (r) => r.cells.map((c, i) => c && <span key={i} className="mr-3 whitespace-nowrap text-sm">{GAP_LABEL[columns[i].gap]}: {c.arrAtRisk ? fmtUsd(c.arrAtRisk) : c.count}</span>) },
            { key: "p", header: "Coverage lost", align: "right", render: (r) => { const s = step.get(r.teamId); return s ? <span className="text-gap">{stepText(s.pts, s.arrAtRisk)}</span> : "–"; } },
          ]}
        />
      </div>
    </Card>
  );
}

/** The graph view for the analytics decision, under the team lens. Never fetched without a change to look at. */
function useGraph(a: Analytics, team: string | null) {
  const d = a.coverage?.caseId ?? null;
  const q = useQuery({ queryKey: ["graph", d, team, ""], queryFn: () => getGraph(d as string, { team }), enabled: d !== null });
  // with a lens, keep only the nodes on that team's paths back to the decision
  const inLens = (id: string) => !q.data?.lens || q.data.lens.nodeIds.includes(id);
  return { ...q, nodes: (q.data?.nodes ?? []).filter((n) => inLens(n.id)) };
}

/** Loading, error and empty states for the graph-backed tabs; renders `children` only when there is something to show. */
function GraphState({ a, q, empty, children }: { a: Analytics; q: { isPending: boolean; error: Error | null; refetch: () => unknown }; empty: string | null; children: React.ReactNode }) {
  if (!a.coverage) return <p className="text-sm text-faint">No open change to trace.</p>;
  if (q.error) return <p className="text-sm text-conflict">Could not load the graph: {q.error.message}. <button className="underline" onClick={() => void q.refetch()}>Retry</button></p>;
  if (q.isPending) return <div className="h-40 animate-pulse rounded-inset bg-raised" aria-busy="true" aria-label="Loading the graph" />;
  if (empty) return <p className="text-sm text-faint">{empty}</p>;
  return <>{children}</>;
}

function ByCustomer({ a, team }: { a: Analytics; team: string | null }) {
  const q = useGraph(a, team);
  const items = q.nodes.filter((n) => n.kind === "customers").flatMap((n) => n.items);
  const c = a.coverage;
  return (
    <Card>
      <CardHeader title="By customer" sub={c ? <>{c.notices.sent} of {c.notices.of} notices sent{c.notices.demo && <Demo />}{q.data && <> · {plural(items.length, "customer")} on the system in the graph</>}</> : "No open change"} />
      <div className="mt-4">
        <GraphState a={a} q={q} empty={items.length ? null : team ? "No customers on this team's paths to the change." : "No customers on the systems this change touches."}>
          <DataTable caption="Customers" rows={items} rowKey={(r) => r.id}
            columns={[
              { key: "n", header: "Customer", render: (r) => <span className="font-medium">{r.label}</span> },
              { key: "s", header: "Status", render: (r) => r.conflict ? <StatusPill tone="conflict">Contract conflict</StatusPill> : <StatusPill tone="neutral">Uses the system</StatusPill> },
              { key: "d", header: "In the graph since", align: "right", render: (r) => fmtDay(r.validFrom) },
            ]}
            footer={<span>From the customers cluster of the graph below</span>}
          />
        </GraphState>
      </div>
    </Card>
  );
}

function BySystem({ a, team }: { a: Analytics; team: string | null }) {
  const q = useGraph(a, team);
  const systems = q.nodes.filter((n) => n.kind === "system");
  const tone = { conflict: "conflict", gap: "gap", covered: "covered", neutral: "neutral" } as const;
  return (
    <Card>
      <CardHeader title="By system" sub={q.data ? `${plural(systems.length, "system")} the change touches, traced in the graph` : "Systems the change touches, traced in the graph"} />
      <div className="mt-4">
        <GraphState a={a} q={q} empty={systems.length ? null : team ? "No systems on this team's paths to the change." : "The graph has no systems for this change."}>
          <DataTable caption="Systems" rows={systems} rowKey={(r) => r.id}
            columns={[
              { key: "n", header: "System", render: (r) => <><span className="block font-medium">{r.title}</span><span className="text-xs text-faint">{r.subtitle}</span></> },
              { key: "s", header: "Status", render: (r) => <StatusPill tone={tone[r.status]}>{r.status === "neutral" ? "No gap" : r.status === "gap" ? "Not told" : r.status === "conflict" ? "Conflict" : "Covered"}</StatusPill> },
              { key: "c", header: "Linked records", align: "right", render: (r) => r.count },
            ]}
          />
        </GraphState>
      </div>
    </Card>
  );
}
