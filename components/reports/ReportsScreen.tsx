"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { parseAsStringLiteral, useQueryState } from "nuqs";
import { useMemo, useState } from "react";
import { ExternalLink, FileText, Search } from "lucide-react";
import { PageHeader } from "@/components/shell/PageHeader";
import { GraphDownBanner } from "@/components/states/States";
import { Card, CardHeader } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { DotStrip } from "@/components/ui/dot-strip";
import { EmptyState } from "@/components/ui/empty-state";
import { HatchedBar } from "@/components/ui/hatched-bar";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusPill } from "@/components/ui/status-pill";
import { getActivity, getReports, isGraphDown } from "@/lib/api";
import { daysLeft, day, dayTime, KIND_LABEL, listSentence, matches, relDays, safeUrl, STATE, usd, worstFirst } from "@/lib/reports-ui";
import type { ReportRow } from "@/lib/schemas/reports";
import { DemoTag, KIND_ICON, Segmented, TabPanel } from "./shared";

const TABS = ["cases", "activity"] as const;
const STATES = ["all", "blocked", "waiting", "done"] as const;
const ACTORS = ["all", "person", "agent", "system"] as const;
const DOT_TONE = { blocked: "conflict", waiting: "gap", done: "covered" } as const;
const DOT_BG = { blocked: "bg-conflict", waiting: "bg-gap", done: "bg-covered" } as const;

export const coverageTone = (pct: number) => (pct < 50 ? "text-conflict" : pct < 100 ? "text-gap" : "text-strong");

export function ReportsScreen() {
  const [tab, setTab] = useQueryState("tab", parseAsStringLiteral(TABS).withDefault("cases"));
  const { data, error, refetch } = useQuery({ queryKey: ["reports"], queryFn: getReports });
  return (
    <>
      <PageHeader title="Reports" subtitle={data ? listSentence(data.summary.total, data.summary.needYou) : "Every change, and everything Ripple did for it."}>
        <Segmented tabs="reports" label="Reports view" value={tab} onChange={(v) => void setTab(v)} options={[{ id: "cases", label: "Cases" }, { id: "activity", label: "Activity" }]} />
      </PageHeader>
      {isGraphDown(error) ? <GraphDownBanner onRetry={() => void refetch()} /> : <TabPanel tabs="reports" id={tab}>{tab === "activity" ? <ActivityFeed /> : <Cases data={data} />}</TabPanel>}
    </>
  );
}

function Cases({ data }: { data?: Awaited<ReturnType<typeof getReports>> }) {
  const [q, setQ] = useState("");
  const [state, setState] = useQueryState("state", parseAsStringLiteral(STATES).withDefault("all"));
  const all = useMemo(() => worstFirst(data?.cases ?? []), [data]);
  const rows = all.filter((r) => (state === "all" || r.state === state) && matches(r, q));
  if (!data) return <div className="space-y-4"><Skeleton className="h-64 rounded-card" /><Skeleton className="h-96 rounded-card" /></div>;
  if (!all.length)
    return <Card><EmptyState icon={FileText} title="No changes on record yet" action={{ label: "Ask the assistant", href: "/" }}>When a change is announced, its case file shows up here.</EmptyState></Card>;

  const dated = all.filter((r): r is ReportRow & { effectiveAt: number } => r.effectiveAt !== null); // undated cases have no place on the axis
  const days = dated.map((r) => daysLeft(r.effectiveAt, data.now));
  const min = Math.min(0, ...days) - 10;
  const max = Math.max(60, ...days) + 10;
  const pos = (v: number) => ((v - min) / (max - min)) * 100; // DotStrip places values on a 0-100 axis
  const by = data.summary.byState;
  const controls = (
            <div className="flex flex-wrap items-center gap-2">
              <label className="flex h-10 w-full items-center gap-2 rounded-control border border-hairline bg-surface px-3 text-sm sm:w-64">
                <Search size={15} aria-hidden className="text-faint" />
                <span className="sr-only">Search cases</span>
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search cases, systems, teams" className="min-w-0 flex-1 bg-transparent text-strong outline-none placeholder:text-faint" />
              </label>
              <Segmented label="Filter by state" value={state} onChange={(v) => void setState(v)} options={STATES.map((s) => ({ id: s, label: s === "all" ? "All" : STATE[s].label.split(" ")[0] }))} />
            </div>
  );
  const legend = (
            <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-faint">
              {(["blocked", "waiting", "done"] as const).map((s) => (
                <li key={s} className="flex items-center gap-1.5"><span aria-hidden className={`size-2 rounded-full ${DOT_BG[s]}`} />{STATE[s].label} {by[s] ?? 0}</li>
              ))}
            </ul>
  );
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader
          title={`${data.summary.total} ${data.summary.total === 1 ? "change" : "changes"} by state`}
          sub="One dot per change, placed by the days left until it takes effect"
          action={<div className="hidden sm:block">{legend}</div>}
        />
        <div className="mt-3 sm:hidden">{legend}</div>
        <div className="mt-8">
          <DotStrip
            label="Changes by days until they take effect"
            min={0} max={100} cols={60}
            selected={all[0].id}
            marker={{ value: pos(0), label: "Today" }}
            dots={dated.map((r, i) => ({ id: r.id, value: pos(days[i]), tone: DOT_TONE[r.state], label: `${r.title} · ${r.coverage.pct}% told` }))}
            ticks={[{ value: 0, label: `${-min} days ago` }, { value: 100, label: `in ${max} days` }]}
          />
        </div>
        <p className="mt-5 text-sm text-faint">
          <span className="font-medium text-strong">{all[0].title}</span> is the worst case: {all[0].coverage.pct}% of teams told
          {all[0].effectiveAt ? `, effective ${relDays(all[0].effectiveAt, data.now)}` : ""}.
          {all.length > dated.length && ` ${all.length - dated.length} without an effective date ${all.length - dated.length === 1 ? "is" : "are"} not plotted.`}
        </p>
      </Card>

      <Card>
        <CardHeader
          title="Needs attention first"
          sub="Blocked first, then the lowest coverage"
          action={<div className="hidden lg:block">{controls}</div>}
        />
        <div className="mt-4 lg:hidden">{controls}</div>
        <div className="mt-5">
          <DataTable<ReportRow>
            caption="Cases, worst first"
            rows={rows}
            rowKey={(r) => r.id}
            highlight={all[0].id}
            columns={[
              { key: "case", header: "Case", render: (r) => (
                <Link href={`/reports/${encodeURIComponent(r.id)}`} className="block min-w-48 hover:underline">
                  <span className="block font-medium">{r.title}</span>
                  <span className="block text-xs text-faint">{r.id.toUpperCase()} · announced {day(r.announcedAt)}</span>
                </Link>
              ) },
              { key: "sys", header: "Systems", render: (r) => (
                <><span className="block">{r.systems.map((s) => s.name).join(", ") || "None"}</span><span className="block text-xs text-faint">{r.coverage.affected} teams affected</span></>
              ) },
              { key: "eff", header: "Effective", render: (r) => r.effectiveAt ? (<><span className="block">{day(r.effectiveAt)}</span><span className="block text-xs text-faint">{relDays(r.effectiveAt, data.now)}</span></>) : <span className="text-faint">No date</span> },
              { key: "arr", header: "ARR at risk", align: "right", render: (r) => <span className={r.arrAtRisk === null ? "text-faint" : ""}>{usd(r.arrAtRisk)}</span> },
              { key: "cov", header: "Coverage", render: (r) => (
                <span className="flex items-center gap-3">
                  <span className={`w-10 text-right ${coverageTone(r.coverage.pct)}`}>{r.coverage.pct}%</span>
                  <span className="relative w-20"><HatchedBar plan={100} actual={r.coverage.pct} max={100} tone={r.coverage.pct < 100 ? "ink" : "ripple"} label={`${r.coverage.told} of ${r.coverage.affected} teams told`} /></span>
                  <span aria-hidden className="h-4 w-0.5 rounded-full bg-strong" />
                </span>
              ) },
              { key: "gap", header: "Main gap", render: (r) => (
                <><span className="block">{r.mainGap ? `${r.mainGap.name} not told` : "None"}</span>
                  {r.openConflicts > 0 && <span className="block text-xs text-conflict">{r.openConflicts} contract {r.openConflicts === 1 ? "conflict" : "conflicts"}</span>}</>
              ) },
              { key: "st", header: "Status", render: (r) => <StatusPill tone={STATE[r.state].tone}>{STATE[r.state].label}</StatusPill> },
            ]}
            footer={<span>Showing {rows.length} of {all.length} {all.length === 1 ? "case" : "cases"}</span>}
          />
          {!rows.length && <p className="px-2 pt-4 text-sm text-faint">No case matches. Clear the search or pick All.</p>}
        </div>
      </Card>
    </div>
  );
}

function ActivityFeed() {
  const [actor, setActor] = useQueryState("actor", parseAsStringLiteral(ACTORS).withDefault("all"));
  const { data } = useQuery({ queryKey: ["activity", actor], queryFn: () => getActivity(actor) });
  const items = data?.items ?? [];
  const demo = items.filter((i) => i.demo).length;
  return (
    <Card>
      <CardHeader
        title="Everything Ripple did"
        sub={data ? `${items.length} events across every case, newest first${demo ? `. ${demo} are seeded demo history.` : "."}` : "Loading events"}
        action={<Segmented label="Filter by actor" value={actor} onChange={(v) => void setActor(v)} options={[{ id: "all", label: "All" }, { id: "person", label: "People" }, { id: "agent", label: "Agents" }, { id: "system", label: "System" }]} />}
      />
      {!data ? <Skeleton className="mt-6 h-72 rounded-inset" /> : items.length === 0 ? (
        <p className="mt-6 text-sm text-faint">Nothing recorded for this filter yet.</p>
      ) : (
        <ol className="mt-4 divide-y divide-hairline">
          {items.map((it, i) => {
            const Icon = KIND_ICON[it.kind];
            return (
              <li key={`${it.caseId}-${it.id}-${i}`} className="grid grid-cols-[auto_1fr] items-start gap-3 py-3 sm:grid-cols-[7.5rem_auto_1fr_auto] sm:items-center">
                <time className="hidden text-sm tabular-nums text-faint sm:block">{dayTime(it.at)}</time>
                <span className={`grid size-9 place-items-center rounded-full ${it.kind === "conflict" ? "bg-conflict-soft text-conflict" : "bg-raised text-body"}`}><Icon size={16} aria-hidden /></span>
                <div className="min-w-0">
                  <p className="text-md text-strong">{it.text} {it.demo && <DemoTag />}</p>
                  <p className="text-sm text-faint">
                    <span className="sm:hidden">{dayTime(it.at)} · </span>
                    {KIND_LABEL[it.kind]} by {it.actor.name} · <Link href={`/reports/${encodeURIComponent(it.caseId)}`} className="text-body hover:underline">{it.caseTitle}</Link>
                  </p>
                </div>
                {safeUrl(it.url) && (
                  <a href={safeUrl(it.url)!} target="_blank" rel="noreferrer" className="col-start-2 inline-flex items-center gap-1 text-sm font-medium text-strong hover:underline sm:col-start-auto">
                    Open <ExternalLink size={13} aria-hidden />
                  </a>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </Card>
  );
}
