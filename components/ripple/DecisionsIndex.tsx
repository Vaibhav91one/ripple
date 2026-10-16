"use client";

import { useQueries, useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { PageHeader } from "@/components/shell/PageHeader";
import { GraphDownBanner, LoadingBlock } from "@/components/states/States";
import { getDecisions, getRipple, isGraphDown } from "@/lib/api";
import { StatusPills } from "./StatusPills";

const fmt = (ts: number) => new Date(ts * 1000).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

/** /decisions: open and resolved decisions with their conflict and gap counts. */
export function DecisionsIndex() {
  const { data = [], isPending, error, refetch } = useQuery({ queryKey: ["decisions"], queryFn: getDecisions });
  // counts come from each decision's ripple; decisions without one just show no pills
  const ripples = useQueries({ queries: data.map((x) => ({ queryKey: ["ripple", x.id], queryFn: () => getRipple(x.id), retry: false })) });
  const all = data.map((x, i) => ({ x, c: ripples[i]?.data?.counts }));
  const groups = [
    { title: "Open", rows: all.filter(({ x }) => x.status !== "superseded") },
    { title: "Resolved", rows: all.filter(({ x }) => x.status === "superseded") },
  ];
  return (
    <div className="mx-auto flex w-full max-w-[960px] flex-col gap-6 px-8 py-8">
      {isGraphDown(error) && <GraphDownBanner onRetry={() => void refetch()} />}
      {isPending && <LoadingBlock label="Loading decisions" />}
      <PageHeader title="Decisions" subtitle="Open a decision to see who it reaches and who has not been told." />
      {groups.map(({ title, rows }) =>
        rows.length ? (
          <section key={title} className="overflow-hidden rounded-xl bg-surface shadow-[var(--kit-shadow-card)]">
            <h2 className="border-b border-hairline px-4 py-3 text-[12.5px] font-medium text-strong">
              {title} <span className="tabular-nums text-faint">{rows.length}</span>
            </h2>
            <ul className="divide-y divide-hairline">
              {rows.map(({ x, c }) => (
                <li key={x.id}>
                  <Link href={`/decisions/${x.id}`} className="flex items-center gap-4 px-4 py-3 text-sm transition-colors hover:bg-raised focus-visible:outline-2 focus-visible:outline-ripple">
                    <span className="min-w-0 flex-1 truncate text-strong">{x.title}</span>
                    <span className="shrink-0 text-xs text-faint">{fmt(x.decidedAt)}</span>
                    {c && <StatusPills conflicts={c.conflicts} notTold={c.notTold} />}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null,
      )}
    </div>
  );
}
