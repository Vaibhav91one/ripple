"use client";

import { useQuery } from "@tanstack/react-query";
import { parseAsString, useQueryState } from "nuqs";
import { useState } from "react";
import { ConflictDetail, type Choice } from "@/components/panels/ConflictDetail";
import { LoadingBlock } from "@/components/states/States";
import { getChangeApprovals, getChanges, getNames } from "@/lib/api";
import { describeEdge } from "@/lib/changes";
import type { EdgeType, RippleResult } from "@/lib/schemas";
import { filterChanges, nameOf as nameFrom, typeCounts } from "./helpers";

const RESULT: Record<Choice, string> = {
  acknowledge: "Legal acknowledged the conflict. The gap shrinks once the ack is written.",
  move_date: "Proposal sent to Eng: move the sunset after Jun 30.",
  negotiate: "Task created for Legal: negotiate clause 7.2 with both customers.",
};
const day = (ts: number) => new Date(ts * 1000).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const empty = (text: string) => <p className="rounded-xl bg-surface px-4 py-16 text-center text-sm text-faint shadow-[var(--kit-shadow-card)]">{text}</p>;

/** The conflict detail screen as a tab. `?conflict=<id>` puts that conflict first; `?conflict=open` shows them in order. */
export function ConflictsTab({ data }: { data: RippleResult }) {
  const [sel] = useQueryState("conflict", parseAsString);
  const [done, setDone] = useState<Record<string, Choice>>({});
  if (!data.conflicts.length) return empty("No conflicts: nothing the teams promised clashes with this change.");
  const rows = [...data.conflicts].sort((a, b) => Number(b.id === sel) - Number(a.id === sel));
  return (
    <div className="mx-auto flex w-full max-w-[880px] flex-col gap-6">
      {rows.map((c) => (
        <div key={c.id}>
          <ConflictDetail conflict={c} arrAtRisk={data.counts.arrAtRisk} onResolve={(ch) => setDone((d) => ({ ...d, [c.id]: ch }))} />
          {done[c.id] && <p role="status" className="mt-3 rounded-md bg-covered-soft px-3 py-2 text-sm text-covered">{RESULT[done[c.id]]}</p>}
        </div>
      ))}
    </div>
  );
}

/** This change's pending actions. #203's approvals screen owns deciding; until it lands this is a list. */
export function ApprovalsTab({ changeId }: { changeId: string }) {
  const { data, isPending } = useQuery({ queryKey: ["change-approvals", changeId], queryFn: () => getChangeApprovals(changeId) });
  if (isPending) return <LoadingBlock label="Loading approvals" />;
  if (!data?.length) return empty("Nothing is waiting for approval on this change.");
  return (
    <ul className="divide-y divide-hairline overflow-hidden rounded-xl bg-surface shadow-[var(--kit-shadow-card)]">
      {data.map((a) => (
        <li key={a.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-sm">
          <span className="rounded-md bg-raised px-1.5 py-0.5 font-mono text-xs text-body">{a.kind}</span>
          <span className="min-w-0 flex-1 truncate text-strong">{a.summary}</span>
          <span className="shrink-0 text-xs text-faint">{day(Math.floor(Date.parse(a.requestedAt) / 1000))}</span>
        </li>
      ))}
    </ul>
  );
}

/** Dated edges around this change as sentences (what the old /changes edge diff showed, scoped to the change's ripple). */
export function ActivityTab({ nodeIds }: { nodeIds: Set<string> }) {
  const [types, setTypes] = useState<EdgeType[]>([]);
  const all = useQuery({ queryKey: ["changes", 0], queryFn: () => getChanges(0) });
  const names = useQuery({ queryKey: ["names"], queryFn: getNames });
  const nameOf = nameFrom(names.data ?? {});
  const mine = (all.data ?? []).filter((c) => nodeIds.has(c.edge.from) && nodeIds.has(c.edge.to));
  const rows = filterChanges(mine, types);
  const toggle = (t: EdgeType) => setTypes((cur) => (cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t]));
  if (all.isPending) return <LoadingBlock label="Loading activity" />;
  return (
    <section className="mx-auto w-full max-w-[880px] overflow-hidden rounded-xl bg-surface shadow-[var(--kit-shadow-card)]">
      <div className="flex flex-wrap items-center gap-1.5 border-b border-hairline px-4 py-3">
        <span className="mr-1 text-[12.5px] font-medium text-strong">Edge type</span>
        {typeCounts(mine).map(([t, n]) => (
          <button key={t} type="button" aria-pressed={types.includes(t)} onClick={() => toggle(t)}
            className={`inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 font-mono text-[11px] transition-colors ${types.includes(t) ? "bg-ripple-soft text-ripple" : "bg-page text-body hover:bg-raised"}`}>
            {t}<span className="tabular-nums text-faint">{n}</span>
          </button>
        ))}
      </div>
      {rows.length === 0 ? empty("No dated edges around this change yet.") : (
        <ul className="divide-y divide-hairline">
          {rows.map((c, i) => (
            <li key={`${c.edge.from}-${c.edge.type}-${c.edge.to}-${c.at}-${i}`} className="flex items-center gap-3 px-4 py-2.5 text-sm">
              <span aria-hidden className={`size-1.5 shrink-0 rounded-full ${c.kind === "ended" ? "bg-conflict" : "bg-covered"}`} />
              <span className="min-w-0 flex-1 text-body">
                {c.kind === "ended" ? "Ended: " : ""}{describeEdge(c.edge, nameOf)}
              </span>
              <time className="shrink-0 text-xs tabular-nums text-faint">{day(c.at)}</time>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
