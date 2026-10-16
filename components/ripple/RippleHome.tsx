"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import LoadingState from "@/components/kit/beautifului/loading-state";
import { AnimatedCount } from "@/components/motion/AnimatedCount";
import { CardEnter } from "@/components/motion/CardEnter";
import { GapChips } from "@/components/motion/GapChips";
import { getRipple } from "@/lib/api";
import { RippleGraph } from "./RippleGraph";
import { TeamCard, type TeamStatus } from "./TeamCard";
import { useDecisionId } from "./useDecisionId";

const ORDER: Record<TeamStatus, number> = { conflict: 0, gap: 1, covered: 2 };

export function RippleHome() {
  const [d] = useDecisionId();
  const { data, isPending, error } = useQuery({ queryKey: ["ripple", d], queryFn: () => getRipple(d) });
  const [notified, setNotified] = useState(false);

  if (isPending)
    return <div className="grid h-full place-items-center"><LoadingState /></div>;
  if (error)
    return <p className="p-8 text-conflict">{error.message}</p>;

  const name = (id: string) => data.nodes.find((n) => n.id === id)?.label ?? id[0].toUpperCase() + id.slice(1);
  const conflictRefs = new Set(data.conflicts.flatMap((c) => c.contractIds));
  const status = (t: (typeof data.teams)[number]): TeamStatus =>
    t.why.some((w) => conflictRefs.has(w.ref)) ? "conflict" : data.gap.includes(t.teamId) ? "gap" : "covered";
  const cards = data.teams.map((t) => ({ t, s: status(t) })).sort((a, b) => ORDER[a.s] - ORDER[b.s]);
  const { teamsAffected, notTold, conflicts } = data.counts;

  return (
    <div className="flex h-full flex-col">
      <div className="flex min-h-0 flex-1">
        <section className="relative min-w-0 basis-3/5 p-4">
          <RippleGraph data={data} />
          <p className="absolute bottom-3 left-5 text-xs text-faint">
            Rings are hops. Sectors group customers {data.counts.customers}, tickets {data.counts.tickets}, deals {data.counts.deals}, contracts {data.counts.contracts}.
          </p>
        </section>
        <section className="flex min-w-0 basis-2/5 flex-col gap-3 overflow-y-auto border-l border-hairline p-5">
          <h1 className="text-lg text-strong">
            <AnimatedCount value={teamsAffected} /> affected
            <span className="text-faint"> · </span>
            <span className="text-gap"><AnimatedCount value={notTold} /> not told</span>
            <span className="text-faint"> · </span>
            <span className="text-conflict"><AnimatedCount value={conflicts} /> conflict{conflicts === 1 ? "" : "s"}</span>
          </h1>
          <div className="flex flex-col gap-2.5">
            <CardEnter>
              {cards.map(({ t, s }) => (
                <TeamCard key={t.teamId} name={name(t.teamId)} status={s} team={t} cypher={s === "gap" ? (data.cypher[1] ?? data.cypher[0]) : data.cypher[0]} />
              ))}
            </CardEnter>
          </div>
        </section>
      </div>
      <footer className="flex h-14 shrink-0 items-center gap-4 border-t border-hairline bg-surface px-5">
        <span className="text-sm text-faint">Not told yet</span>
        <GapChips
          chips={data.gap.map((id) => ({ id, label: name(id) }))}
          renderChip={(c) => <span className="inline-flex h-6 items-center rounded-full bg-gap-soft px-2.5 text-sm font-medium text-gap">{c.label}</span>}
        />
        <div className="ml-auto flex items-center gap-3">
          {notified && <span role="status" className="text-sm text-covered">Briefs queued for {data.gap.length} teams</span>}
          {/* ponytail: no-op until the notify route exists (Phase 3); toast via Bencho when wired */}
          <button
            onClick={() => setNotified(true)}
            className="h-8 rounded-lg bg-gap px-3 text-sm font-medium text-page transition-opacity hover:opacity-90"
          >
            Notify gaps
          </button>
        </div>
      </footer>
    </div>
  );
}
