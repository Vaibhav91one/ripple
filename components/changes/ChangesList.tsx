"use client";

import { useQueries, useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { parseAsString, parseAsStringLiteral, useQueryState } from "nuqs";
import { Segmented } from "@/components/kit/obsidian/analytics/segmented";
import { StatusPills } from "@/components/ripple/StatusPills";
import { PageHeader } from "@/components/shell/PageHeader";
import { GraphDownBanner, LoadingBlock } from "@/components/states/States";
import { getCampaign, getDecisions, getNames, getRipple, isGraphDown } from "@/lib/api";
import { fmtDate } from "@/lib/date";

const day = (ts: number | null) => (ts ? fmtDate(ts) : "No date");
const FILTERS = ["open", "resolved", "all"] as const;
const OPTIONS = [{ id: "open", label: "Open" }, { id: "resolved", label: "Resolved" }, { id: "all", label: "All" }] as const;

/** /changes: every change with its kind, status, date, owner, conflict and gap pills and how far the campaign has got. */
export function ChangesList() {
  const [filter, setFilter] = useQueryState("show", parseAsStringLiteral(FILTERS).withDefault("open"));
  const [q, setQ] = useQueryState("q", parseAsString.withDefault(""));
  const { data = [], isPending, error, refetch } = useQuery({ queryKey: ["decisions"], queryFn: getDecisions });
  const names = useQuery({ queryKey: ["names"], queryFn: getNames }).data ?? {};
  const ripples = useQueries({ queries: data.map((x) => ({ queryKey: ["ripple", x.id], queryFn: () => getRipple(x.id), retry: false })) });
  const camps = useQueries({ queries: data.map((x) => ({ queryKey: ["campaign", x.id], queryFn: () => getCampaign(x.id), retry: false })) });
  const rows = data
    .map((x, i) => ({ x, c: ripples[i]?.data?.counts, camp: camps[i]?.data }))
    .filter(({ x }) => filter === "all" || (filter === "resolved") === (x.status === "superseded"))
    .filter(({ x }) => !q || x.title.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => b.x.decidedAt - a.x.decidedAt);

  return (
    <div className="mx-auto flex w-full max-w-[960px] flex-col gap-6 px-4 py-8 sm:px-8">
      {isGraphDown(error) && <GraphDownBanner onRetry={() => void refetch()} />}
      <PageHeader title="Changes" subtitle="Open a change to see who it reaches, what conflicts, how the campaign is going and what waits for approval.">
        <div className="flex flex-wrap items-center gap-2">
          <label className="sr-only" htmlFor="changes-q">Search changes</label>
          <input id="changes-q" type="search" value={q} onChange={(e) => void setQ(e.target.value || null)} placeholder="Search changes"
            className="h-8 w-44 rounded-lg border border-hairline bg-transparent px-3 text-sm text-strong outline-none placeholder:text-faint focus:border-body" />
          <Segmented label="Show" options={OPTIONS} value={filter} onChange={(v) => void setFilter(v)} />
        </div>
      </PageHeader>
      {isPending && <LoadingBlock label="Loading changes" />}
      {!isPending && rows.length === 0 && <p className="rounded-xl bg-surface px-4 py-16 text-center text-sm text-faint shadow-[var(--kit-shadow-card)]">No changes match.</p>}
      {rows.length > 0 && (
        <ul className="divide-y divide-hairline overflow-hidden rounded-xl bg-surface shadow-[var(--kit-shadow-card)]">
          {rows.map(({ x, c, camp }) => {
            const total = camp?.teams.length ?? 0;
            const done = camp?.teams.filter((t) => t.covered).length ?? 0;
            return (
              <li key={x.id}>
                <Link href={`/changes/${encodeURIComponent(x.id)}`} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 text-sm transition-colors hover:bg-raised focus-visible:outline-2 focus-visible:outline-ripple">
                  <span className="min-w-0 flex-1 basis-60">
                    <span className="block truncate text-strong">{x.title}</span>
                    <span className="block truncate text-xs text-faint">
                      {camp?.kind ?? "decision"} · {x.status === "superseded" ? "resolved" : x.status}
                      {camp ? (camp.owner ? ` · owner ${names[camp.owner] ?? camp.owner}` : " · No owner yet") : ""}
                      {` · effective ${day(camp?.effectiveAt ?? x.decidedAt)}`}
                    </span>
                  </span>
                  {total > 0 && (
                    <span className="flex w-36 shrink-0 items-center gap-2" title={`${done} of ${total} teams covered`}>
                      <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-raised">
                        <span className="block h-full rounded-full bg-covered" style={{ width: `${(done / total) * 100}%` }} />
                      </span>
                      <span className="text-xs tabular-nums text-faint">{done}/{total}</span>
                    </span>
                  )}
                  {c && <StatusPills conflicts={c.conflicts} notTold={c.notTold} />}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
