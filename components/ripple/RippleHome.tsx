"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ToastStack, type Toast } from "@/components/kit/bencho/toast-stack";
import LoadingState from "@/components/kit/beautifului/loading-state";
import { AnimatedCount } from "@/components/motion/AnimatedCount";
import { CardEnter } from "@/components/motion/CardEnter";
import { GapChips } from "@/components/motion/GapChips";
import { getRipple, isGraphDown } from "@/lib/api";
import { GraphDownBanner } from "@/components/states/States";
import { PageHeader } from "@/components/shell/PageHeader";
import { RippleGraph } from "./RippleGraph";
import { TeamCard, type TeamStatus } from "./TeamCard";
import { useDecisionId } from "./useDecisionId";
import { StatusPills } from "./StatusPills";
import { TEAM_TABS, useTeam } from "./useTeam";

type NotifyToastResult = { teamId: string; taskId: string; email: { status: "sent" | "preview" | "failed"; to: string | null } };
const ORDER: Record<TeamStatus, number> = { conflict: 0, gap: 1, covered: 2 };

export function RippleHome() {
  const [d] = useDecisionId();
  const { data, isPending, error, refetch } = useQuery({ queryKey: ["ripple", d], queryFn: () => getRipple(d) });
  const [team, setTeam] = useTeam();
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [busy, setBusy] = useState(false);

  async function notify() {
    setBusy(true);
    try {
      const res = await fetch("/api/notify", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ decisionId: d }) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? res.statusText);
      const made: Toast[] = (json.results as NotifyToastResult[]).map((r) => ({
        id: r.taskId,
        kind: r.email.status === "failed" ? "error" : r.email.status === "sent" ? "success" : "info",
        title: `${name(r.teamId)} briefed`,
        body: r.email.status === "sent" ? `Email sent to ${r.email.to}.` : r.email.status === "failed" ? "Email failed." : "Email saved as preview.",
      }));
      setToasts((t) => [...made.reverse(), ...t]);
    } catch (e) {
      setToasts((t) => [{ id: `err-${Date.now()}`, kind: "error", title: "Notify failed", body: String(e instanceof Error ? e.message : e).slice(0, 80) }, ...t]);
    } finally {
      setBusy(false);
    }
  }

  if (isPending)
    return <div className="grid h-full place-items-center"><LoadingState /></div>;
  if (isGraphDown(error))
    return <div className="p-8"><GraphDownBanner onRetry={() => void refetch()} /></div>;
  if (error)
    return <p className="p-8 text-conflict">{error.message}</p>;

  const name = (id: string) => data.nodes.find((n) => n.id === id)?.label ?? id[0].toUpperCase() + id.slice(1);
  const conflictRefs = new Set(data.conflicts.flatMap((c) => c.contractIds));
  const status = (t: (typeof data.teams)[number]): TeamStatus =>
    t.why.some((w) => conflictRefs.has(w.ref)) ? "conflict" : data.gap.includes(t.teamId) ? "gap" : "covered";
  const cards = data.teams.map((t) => ({ t, s: status(t) })).sort((a, b) => (team ? Number(b.t.teamId === team) - Number(a.t.teamId === team) : 0) || ORDER[a.s] - ORDER[b.s]);
  const { teamsAffected, notTold, conflicts } = data.counts;

  return (
    <div className="flex h-full flex-col">
      <div className="px-5 pt-5">
        <PageHeader
          title={
            <span className="flex items-center gap-3">
              <span className="truncate">{data.decision.title}</span>
              <StatusPills conflicts={conflicts} notTold={notTold} />
            </span>
          }
        >
          <div data-slot="team-tabs" role="group" aria-label="Filter by team" className="flex items-center gap-1 overflow-x-auto">
            {[{ id: null, label: "All" }, ...TEAM_TABS].map((t) => (
              <button
                key={t.label}
                type="button"
                aria-pressed={team === t.id}
                onClick={() => setTeam(t.id)}
                className={`h-7 shrink-0 rounded-md px-2.5 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-ripple ${
                  team === t.id ? "bg-raised font-medium text-strong" : "text-faint hover:text-strong"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </PageHeader>
      </div>
      <div className="flex min-h-0 flex-1">
        <section className="relative min-w-0 basis-3/5 p-4">
          <RippleGraph data={data} team={team} />
          <p className="absolute bottom-3 left-5 text-xs text-faint">
            Rings are hops. Sectors group customers {data.counts.customers}, tickets {data.counts.tickets}, deals {data.counts.deals}, contracts {data.counts.contracts}.
          </p>
        </section>
        <section className="flex min-w-0 basis-2/5 flex-col gap-3 overflow-y-auto border-l border-hairline p-5">
          <p className="text-sm text-body">
            <AnimatedCount value={teamsAffected} /> affected
            <span className="text-faint"> · </span>
            <span className="text-gap"><AnimatedCount value={notTold} /> not told</span>
            <span className="text-faint"> · </span>
            <span className="text-conflict"><AnimatedCount value={conflicts} /> conflict{conflicts === 1 ? "" : "s"}</span>
          </p>
          <div className="flex flex-col gap-2.5">
            <CardEnter>
              {cards.map(({ t, s }) => (
                <div
                  key={t.teamId}
                  className={`rounded-xl transition-opacity duration-200 ${team ? (t.teamId === team ? "ring-1 ring-ripple" : "opacity-45") : ""}`}
                >
                  <TeamCard name={name(t.teamId)} status={s} team={t} cypher={s === "gap" ? (data.cypher[1] ?? data.cypher[0]) : data.cypher[0]} />
                </div>
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
          <button
            onClick={notify}
            disabled={busy}
            className="h-8 rounded-lg bg-gap px-3 text-sm font-medium text-page transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {busy ? "Notifying..." : "Notify gaps"}
          </button>
        </div>
      </footer>
      {toasts.length > 0 && (
        <div className="fixed bottom-20 right-5 z-50" role="status">
          <ToastStack toasts={toasts} onDismiss={(id) => setToasts((t) => t.filter((x) => x.id !== id))} />
        </div>
      )}
    </div>
  );
}
