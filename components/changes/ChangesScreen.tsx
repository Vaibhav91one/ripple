"use client";

import { useQueries, useQuery } from "@tanstack/react-query";
import { parseAsInteger, useQueryState } from "nuqs";
import { useState } from "react";
import { getBottleneck, getChanges, getSource } from "@/lib/api";
import type { EdgeType } from "@/lib/schemas";
import { DAY, defaultSince, filterChanges, nameOf, typeCounts } from "./helpers";

const fmt = (ts: number) =>
  new Date(ts * 1000).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });

const chip =
  "inline-flex h-5.5 items-center gap-1.5 rounded-full bg-page px-2 text-[11.5px] font-medium text-body shadow-[var(--kit-shadow-hairline)]";

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

  const inRange = changes.data ?? [];
  const rows = filterChanges(inRange, types);
  const artifactIds = [...new Set(rows.flatMap((c) => (c.edge.src ? [c.edge.src.artifactId] : [])))];
  const titles = new Map(
    useQueries({
      queries: artifactIds.map((id) => ({ queryKey: ["source", id], queryFn: () => getSource(id) })),
    }).flatMap((q) => (q.data ? [[q.data.id, q.data.title] as const] : [])),
  );

  const toggle = (t: EdgeType) =>
    setTypes((cur) => (cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t]));

  return (
    <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-6 px-8 py-8">
      <header className="flex items-end justify-between gap-8">
        <div>
          <h1 className="text-2xl font-semibold text-strong">What changed</h1>
          <p className="mt-1 text-[13px] text-faint">
            {inRange.length} edge {inRange.length === 1 ? "change" : "changes"} since {fmt(since)}
          </p>
        </div>
        <label className="flex w-[360px] flex-col gap-2 text-[12px] text-faint">
          <span className="flex justify-between">
            <span>Since</span>
            <span className="tabular-nums text-strong">{fmt(since)}</span>
          </span>
          <input
            type="range"
            aria-label="Since"
            className="w-full accent-ripple"
            min={Math.min(earliest, since) - DAY}
            max={latest}
            step={DAY}
            value={since}
            onChange={(e) => setSince(Number(e.target.value))}
          />
        </label>
      </header>

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
            <table className="w-full table-fixed border-collapse text-left">
              <colgroup>
                <col />
                <col className="w-[84px]" />
                <col className="w-[220px]" />
              </colgroup>
              <thead>
                <tr className="border-b border-hairline text-[12px] font-medium text-faint">
                  <th className="px-4 py-2.5">Edge</th>
                  <th className="px-4 py-2.5">When</th>
                  <th className="px-4 py-2.5">Source</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((c, i) => {
                  const ended = c.kind === "ended";
                  const title = c.edge.src && titles.get(c.edge.src.artifactId);
                  return (
                    <tr
                      key={`${c.edge.from}-${c.edge.type}-${c.edge.to}-${c.at}-${i}`}
                      className={`border-b border-hairline last:border-0 ${ended ? "bg-conflict-soft" : "bg-covered-soft"}`}
                    >
                      <td className="px-4 py-3">
                        <div
                          className={`flex items-center gap-2 text-[13px] ${ended ? "text-conflict line-through decoration-conflict/50" : "text-covered"}`}
                        >
                          <span aria-hidden className="w-3 font-mono">{ended ? "−" : "+"}</span>
                          <span className="truncate font-medium">{nameOf(c.edge.from)}</span>
                          <span className="font-mono text-[11px] opacity-80">→ {c.edge.type} →</span>
                          <span className="truncate font-medium">{nameOf(c.edge.to)}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-[12.5px] tabular-nums text-body">{fmt(c.at)}</td>
                      <td className="px-4 py-3">
                        {c.edge.src ? (
                          <span className={`${chip} max-w-full ${ended ? "opacity-60" : ""}`}>
                            <span className={`size-1.5 shrink-0 rounded-full ${ended ? "bg-conflict" : "bg-covered"}`} />
                            <span className="truncate">{title ?? c.edge.src.artifactId}</span>
                          </span>
                        ) : (
                          <span className="text-[12px] text-faint">No source</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </section>

        <aside className="overflow-hidden rounded-xl bg-surface shadow-[var(--kit-shadow-card)]">
          <div className="border-b border-hairline px-4 py-3">
            <h2 className="text-[12.5px] font-medium text-strong">Who&apos;s blocking whom</h2>
            <p className="text-[12px] text-faint">Open requests by blocker team</p>
          </div>
          <ul className="flex flex-col">
            {(bottleneck.data ?? []).map((r) => (
              <li key={r.blockerTeamId} className="flex flex-col gap-2 border-b border-hairline px-4 py-3 last:border-0">
                <div className="flex items-center gap-2.5">
                  <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-strong">
                    {nameOf(r.blockerTeamId)}
                  </span>
                  <span className="inline-flex h-5.5 items-center rounded-full bg-gap-soft px-2 text-[11.5px] font-medium tabular-nums text-gap">
                    {r.oldestDays}d oldest
                  </span>
                </div>
                <div className="flex items-center gap-2 text-[12px] text-body">
                  <span className="tabular-nums">{r.openRequests} open</span>
                  <span className="text-faint">·</span>
                  <span className="tabular-nums">{r.totalWaitDays}d total wait</span>
                </div>
                <div className="flex flex-wrap items-center gap-1.5 text-[12px] text-faint">
                  Waiting:
                  {r.waitingTeamIds.map((id) => (
                    <span key={id} className={chip}>{nameOf(id)}</span>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </div>
  );
}
