"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { parseAsStringLiteral, useQueryState } from "nuqs";
import TaskRows from "@/components/kit/beautifului/task-rows";
import { ActivityChart } from "@/components/kit/obsidian/analytics/activity-chart";
import { formatKpi } from "@/components/teams/format";
import { KpiCard } from "@/components/kit/obsidian/analytics/kpi-card";
import { Leaderboard } from "@/components/kit/obsidian/analytics/leaderboard";
import { Segmented } from "@/components/kit/obsidian/analytics/segmented";
import { StatusPill } from "@/components/kit/obsidian/analytics/status-pill";
import { PageHeader } from "@/components/shell/PageHeader";
import { GraphDownBanner, LoadingBlock } from "@/components/states/States";
import { Widget } from "@/components/teams/TeamFrame";
import { fmtDay } from "@/components/teams/format";
import { useNames } from "@/components/teams/useTeamDashboard";
import { GraphDownError, getOverview } from "@/lib/api";
import type { Overview } from "@/lib/schemas";

const RANGE_IDS = ["7d", "14d"] as const;
const RANGE_DAYS = { "7d": 7, "14d": 14 } as const;

export function OverviewScreen() {
  const q = useQuery({ queryKey: ["overview"], queryFn: getOverview });
  if (!q.data) {
    return (
      <div className="p-6">
        {q.error instanceof GraphDownError ? <GraphDownBanner onRetry={() => q.refetch()} /> : q.error ? <p className="text-sm text-conflict">Could not load the overview.</p> : <LoadingBlock label="Loading the overview" />}
      </div>
    );
  }
  return <Dashboard o={q.data} />;
}

function Dashboard({ o }: { o: Overview }) {
  const name = useNames();
  const [range, setRange] = useQueryState("range", parseAsStringLiteral(RANGE_IDS).withDefault("14d"));
  const [selected, setSelected] = useState<string | null>(null);

  const days = RANGE_DAYS[range];
  const act = o.activity.slice(-days);
  const changes = act.map((a) => a.changes);
  const acks = act.map((a) => a.acks);

  const affected = o.teams.filter((t) => t.affected);
  const ackedPct = affected.length ? Math.round((affected.filter((t) => t.told).length / affected.length) * 100) : 100;
  const conflicts = o.kpis.find((k) => k.id === "conflicts")?.value ?? 0;
  const notTold = o.kpis.find((k) => k.id === "not-told")?.value ?? 0;
  const arr = o.kpis.find((k) => k.id === "arr-at-risk"); // absent when the viewer may not see customer ARR totals

  const sel = o.openDecisions.find((d) => d.decision.id === selected) ?? o.openDecisions[0];

  const people = new Map<string, { value: number; last: number; system: string }>();
  for (const w of o.whoKnows) {
    const p = people.get(w.personId);
    people.set(w.personId, { value: (p?.value ?? 0) + w.authored + w.reviewed + w.handled, last: Math.max(p?.last ?? 0, w.lastSeen), system: p?.system ?? w.systemId });
  }
  const leaders = [...people].sort((a, b) => b[1].value - a[1].value).slice(0, 6)
    .map(([id, p]) => ({ id, name: name(id), value: p.value, meta: `${name(p.system)} · last seen ${fmtDay(p.last)}` }));

  return (
    <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-6 p-6">
      <PageHeader title="Overview" subtitle="What changed, who has been told, and where the gaps are">
        <Segmented label="Range" options={RANGE_IDS.map((id) => ({ id, label: id }))} value={range} onChange={(r) => void setRange(r)} />
      </PageHeader>

      <div className="grid grid-cols-1 gap-6 min-[1180px]:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex min-w-0 flex-col gap-4">
          <section className={`grid grid-cols-2 gap-3 ${arr ? "lg:grid-cols-5" : "lg:grid-cols-4"}`} aria-label="Key numbers">
            <KpiCard index={0} label="Open decisions" value={o.openDecisions.length} spark={changes} />
            <KpiCard index={1} label="Teams not told" value={notTold} spark={changes} sparkTone={notTold ? "gap" : "covered"} />
            <KpiCard index={2} label="Open conflicts" value={conflicts} spark={changes} sparkTone={conflicts ? "conflict" : "covered"} />
            <KpiCard index={3} label="Acked" value={ackedPct} format={(v) => `${Math.round(v)}%`} spark={acks} sparkTone="covered" />
            {arr && <KpiCard index={4} label="ARR at risk" value={arr.value} format={(v) => formatKpi("usd", v)} spark={changes} sparkTone={arr.value ? "conflict" : "covered"} />}
          </section>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Widget title="Open decisions" meta={`${o.openDecisions.length} open`} wide>
              {o.openDecisions.length === 0 && <p className="text-sm text-faint">Every decision has reached every team.</p>}
              <ul className="flex flex-col divide-y divide-hairline">
                {o.openDecisions.map(({ decision: d, notTold: gap }, i) => (
                  <li key={d.id} className={`flex flex-wrap items-center gap-x-3 gap-y-1.5 px-2 py-2.5 ${sel?.decision.id === d.id ? "rounded-md bg-raised" : ""}`}>
                    <Link href={`/decisions/${d.id}`} className="min-w-0 flex-1 truncate text-[13px] font-medium text-strong hover:underline transition-colors">{d.title}</Link>
                    {/* conflicts are counted per graph, tied to the first (main) decision */}
                    {i === 0 && conflicts > 0 && <StatusPill tone="conflict" label={`${conflicts} conflict${conflicts > 1 ? "s" : ""}`} />}
                    {gap.map((t) => <StatusPill key={t} tone="gap" label={`${name(t)} not told`} />)}
                    <button type="button" onClick={() => setSelected(d.id)} className="text-xs text-faint hover:text-strong transition-colors" aria-pressed={sel?.decision.id === d.id}>Details</button>
                  </li>
                ))}
              </ul>
            </Widget>

            <Widget title="Cross-team blockers" meta={`${o.blockers.length}`}>
              {o.blockers.length === 0 ? <p className="text-sm text-faint">Nothing is waiting on another team.</p> : (
                <TaskRows
                  variant="List"
                  rows={o.blockers.slice(0, 6).map((b) => ({ label: `${name(b.fromId)} waits on ${name(b.toId)}`, meta: `since ${fmtDay(b.since)}`, status: "pending" as const }))}
                />
              )}
            </Widget>

            <Widget title="Activity" meta={`last ${days} days`}>
              <ActivityChart
                bars={act.map((a) => ({ label: String(new Date(a.day * 1000).getUTCDate()), segments: [{ key: "changes", value: a.changes }, { key: "acks", value: a.acks }] }))}
                legend={[{ key: "changes", label: "Changes", tone: "ripple" }, { key: "acks", label: "Acks", tone: "covered" }]}
              />
            </Widget>

            <Widget title="Who knows" meta="closest to the sunset system">
              <Leaderboard rows={leaders} unit="touches" />
            </Widget>

            <Widget title="Recent changes" meta={<Link href="/changes" className="hover:text-strong transition-colors">See all</Link>}>
              <ul className="flex flex-col divide-y divide-hairline text-[13px]">
                {o.recentChanges.slice(0, 6).map((c, i) => (
                  <li key={i} className="flex items-center gap-3 py-2">
                    <span className="w-14 shrink-0 text-xs tabular-nums text-faint">{fmtDay(c.at)}</span>
                    <span className="min-w-0 flex-1 truncate text-body">{name(c.edge.from)} <span className="text-faint">{c.edge.type.toLowerCase().replace(/_/g, " ")}</span> {name(c.edge.to)}</span>
                    <StatusPill tone={c.kind === "added" ? "covered" : "neutral"} label={c.kind} />
                  </li>
                ))}
              </ul>
            </Widget>
          </div>

          <section aria-label="Team health">
            <h2 className="mb-3 text-sm font-semibold text-strong">Team health</h2>
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-7">
              {o.teams.map((t) => (
                <li key={t.teamId}>
                  <Link href={`/teams/${t.teamId}`} className="flex h-full flex-col gap-2 rounded-lg border border-hairline bg-surface p-3 transition-colors hover:bg-raised">
                    <span className="truncate text-[13px] font-medium text-strong">{t.name}</span>
                    <span className="text-xs text-faint">{t.people} people · {t.affected ? (t.told ? "told" : "not told") : "not affected"}</span>
                    <StatusPill className="self-start" tone={!t.affected ? "neutral" : t.told ? "covered" : "gap"} label={!t.affected ? "clear" : t.told ? "covered" : "gap"} />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <aside className="hidden min-[1180px]:sticky min-[1180px]:top-6 min-[1180px]:block min-[1180px]:self-start" aria-label="Decision details">
          <div className="flex flex-col gap-3 rounded-lg border border-hairline bg-surface p-4">
            <h2 className="text-sm font-semibold text-strong">Details</h2>
            {sel ? (
              <>
                <p className="text-[13px] font-medium text-strong">{sel.decision.title}</p>
                <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-xs">
                  <dt className="text-faint">Status</dt><dd className="text-body">{sel.decision.status}</dd>
                  <dt className="text-faint">Decided</dt><dd className="text-body">{fmtDay(sel.decision.decidedAt)}</dd>
                  <dt className="text-faint">Not told</dt><dd className="text-body">{sel.notTold.map(name).join(", ") || "nobody"}</dd>
                </dl>
                <Link href={`/decisions/${sel.decision.id}`} className="text-xs text-strong underline-offset-2 hover:underline transition-colors">Open decision</Link>
              </>
            ) : <p className="text-sm text-faint">Select an open decision to see its summary.</p>}
          </div>
        </aside>
      </div>
    </div>
  );
}
