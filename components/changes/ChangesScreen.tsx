"use client";

import { useQueries, useQuery } from "@tanstack/react-query";
import { parseAsInteger, useQueryState } from "nuqs";
import { useState } from "react";
import { getBottleneck, getChanges, getNames, getSource, isGraphDown } from "@/lib/api";
import { PageHeader } from "@/components/shell/PageHeader";
import { GraphDownBanner } from "@/components/states/States";
import type { EdgeType } from "@/lib/schemas";
import DiffTable, { DiffChip, type DiffRow } from "@/components/kit/beautifului/diff-table";
import TaskRows, { type TaskRowInput } from "@/components/kit/beautifului/task-rows";
import { Scrub } from "@/components/kit/bencho/time-scrubber";
import { DAY, defaultSince, filterChanges, nameOf as nameFrom, typeCounts } from "./helpers";

const fmt = (ts: number) =>
  new Date(ts * 1000).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });

export function ChangesScreen() {
  const [sinceParam, setSince] = useQueryState("since", parseAsInteger);
  const [types, setTypes] = useState<EdgeType[]>([]);

  // Every change ever: bounds the scrubber and gives the default `since`.
  const everything = useQuery({ queryKey: ["changes", 0], queryFn: () => getChanges(0) });
  const all = everything.data ?? [];
  const since = sinceParam ?? defaultSince(all);
  const latest = all.length ? Math.max(...all.map((c) => c.at)) : since;
  const earliest = all.length ? Math.min(...all.map((c) => c.at)) : since;

  const changes = useQuery({
    queryKey: ["changes", since],
    queryFn: () => getChanges(since),
    enabled: everything.isSuccess,
  });
  const bottleneck = useQuery({ queryKey: ["bottleneck"], queryFn: getBottleneck });
  const namesQ = useQuery({ queryKey: ["names"], queryFn: getNames });
  const nameOf = nameFrom(namesQ.data ?? {});
  const down = [everything, changes, bottleneck, namesQ].find((q) => isGraphDown(q.error));

  const inRange = changes.data ?? [];
  const rows = filterChanges(inRange, types);
  const artifactIds = [...new Set(rows.flatMap((c) => (c.edge.src ? [c.edge.src.artifactId] : [])))];
  const titles = new Map(
    useQueries({
      queries: artifactIds.map((id) => ({ queryKey: ["source", id], queryFn: () => getSource(id) })),
    }).flatMap((q) => (q.data ? [[q.data.id, q.data.title] as const] : [])),
  );

  const tableRows: DiffRow[] = rows.map((c, i) => {
    const ended = c.kind === "ended";
    const title = c.edge.src && (titles.get(c.edge.src.artifactId) ?? c.edge.src.artifactId);
    return {
      id: `${c.edge.from}-${c.edge.type}-${c.edge.to}-${c.at}-${i}`,
      tone: ended ? "removed" : "added",
      cells: [
        <span key="e" className="flex min-w-0 items-center gap-2">
          <span className="truncate">{nameOf(c.edge.from)}</span>
          <span className="shrink-0 font-mono text-[11px] opacity-80">→ {c.edge.type} →</span>
          <span className="truncate">{nameOf(c.edge.to)}</span>
        </span>,
        fmt(c.at),
        title ? <DiffChip key="s" label={title} dot={ended ? "bg-conflict" : "bg-covered"} tone={ended ? "removed" : "added"} /> : <span key="s" className="text-faint">No source</span>,
      ],
    };
  });
  const taskRows: TaskRowInput[] = (bottleneck.data ?? []).map((r) => ({
    label: nameOf(r.blockerTeamId),
    meta: `${r.openRequests} open · ${r.totalWaitDays} days total`,
    status: "pending",
    detail: `Oldest wait ${r.oldestDays} days. Waiting: ${r.waitingTeamIds.map(nameOf).join(", ")}`,
  }));

  const toggle = (t: EdgeType) =>
    setTypes((cur) => (cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t]));

  return (
    <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-6 px-8 py-8">
      {down && <GraphDownBanner onRetry={() => void down.refetch()} />}
      <PageHeader
        title="What changed"
        subtitle={`${inRange.length} edge ${inRange.length === 1 ? "change" : "changes"} since ${fmt(since)}`}
      >
        <Scrub mode="days" min={Math.min(earliest, since) - DAY} max={latest} value={since} onChange={setSince} />
      </PageHeader>

      <div className="grid grid-cols-[1fr_360px] items-start gap-6">
        <section className="overflow-hidden rounded-xl bg-surface shadow-[var(--kit-shadow-card)]">
          <div className="flex flex-wrap items-center gap-1.5 border-b border-hairline px-4 py-3">
            <span className="mr-1 text-[12.5px] font-medium text-strong">Edge type</span>
            {typeCounts(inRange).map(([t, n]) => (
              <button
                key={t}
                type="button"
                aria-pressed={types.includes(t)}
                onClick={() => toggle(t)}
                className={`inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 font-mono text-[11px] transition-colors ${
                  types.includes(t) ? "bg-ripple-soft text-ripple" : "bg-page text-body hover:bg-raised"
                }`}
              >
                {t}
                <span className="tabular-nums text-faint">{n}</span>
              </button>
            ))}
          </div>

          {rows.length === 0 ? (
            <p className="px-4 py-16 text-center text-[13px] text-faint">
              {changes.isPending ? "Loading changes…" : `Nothing changed since ${fmt(since)}. Drag the scrubber back.`}
            </p>
          ) : (
            <DiffTable
              title="Edge changes"
              className="max-w-none [&>div]:rounded-none [&>div]:shadow-none"
              animate={false}
              columns={[
                { label: "Edge", width: "58%" },
                { label: "When", width: "12%" },
                { label: "Source", width: "30%" },
              ]}
              rows={tableRows}
            />
          )}
        </section>

        <aside className="flex flex-col gap-2">
          <div className="px-1">
            <h2 className="text-[12.5px] font-medium text-strong">Who&apos;s blocking whom</h2>
            <p className="text-[12px] text-faint">Open requests by blocker team</p>
          </div>
          <TaskRows rows={taskRows} />
        </aside>
      </div>
    </div>
  );
}
