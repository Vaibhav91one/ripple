"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/shell/PageHeader";
import { TEAMS } from "@/components/shell/nav";
import { GraphDownBanner, LoadingBlock } from "@/components/states/States";
import { card } from "@/components/ui/hatch";
import { decideIt, getIt, isGraphDown } from "@/lib/api";
import type { ItRequest } from "@/lib/schemas";
import { fmtDate } from "@/lib/date";

const date = fmtDate;
const plural = (n: number, one: string) => `${n} ${n === 1 ? one : `${one}s`}`;
const teamLabel = (id: string | null) => (id ? (TEAMS.find((t) => t.id === id)?.label ?? id) : "No team");
const btn = "rounded-control border border-hairline px-2.5 py-1 text-2xs font-medium text-body transition-colors hover:bg-raised hover:text-strong focus-visible:outline-2 focus-visible:outline-ripple disabled:opacity-50";

function Row({ r, canDecide, busy, onDecide }: { r: ItRequest; canDecide: boolean; busy: boolean; onDecide: (verb: "grant" | "deny") => void }) {
  const open = r.status === "open";
  return (
    <li className="flex flex-col gap-2 border-t border-hairline px-4 py-3 first:border-t-0 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0 space-y-1">
        <p className="text-sm text-strong">
          <span className="font-medium">{r.personName ?? r.personId}</span>
          <span className="text-faint"> needs </span>
          <span className="font-medium">{r.resourceName}</span>
          <span className="ml-2 rounded-full border border-hairline px-1.5 py-px text-2xs text-faint">{r.resourceKind === "group" ? "access group" : "software"}</span>
        </p>
        <p className="text-sm text-body">{r.justification}</p>
        {r.quote && <blockquote className="border-l-2 border-hairline pl-2 text-sm text-faint">&ldquo;{r.quote}&rdquo;</blockquote>}
        <p className="text-2xs text-faint">
          {r.changeTitle ?? r.decisionId}
          {r.deadline !== null && ` · needed by ${date(r.deadline)}`} · expires {date(r.expiresAt)} · approvers: {r.approvers.map(teamLabel).join(", ")}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {open ? (
          <>
            <button type="button" className={btn} disabled={!canDecide || busy} title={canDecide ? undefined : "Only an admin or team lead can decide."} onClick={() => onDecide("grant")}>Mark granted</button>
            <button type="button" className={btn} disabled={!canDecide || busy} title={canDecide ? undefined : "Only an admin or team lead can decide."} onClick={() => onDecide("deny")}>Deny</button>
          </>
        ) : (
          <span className="text-2xs font-medium text-faint">{r.status === "granted" ? "Granted" : "Denied"}{r.decidedAt !== null && ` · ${date(r.decidedAt)}`}</span>
        )}
      </div>
    </li>
  );
}

export function ItScreen() {
  const qc = useQueryClient();
  const { data, isPending, error, refetch } = useQuery({ queryKey: ["it"], queryFn: getIt });
  const decide = useMutation({
    mutationFn: ({ ids, verb }: { ids: string[]; verb: "grant" | "deny" }) => decideIt(ids, verb),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["it"] }),
  });

  const all = data?.requests ?? [];
  const open = all.filter((r) => r.status === "open");
  const done = all.filter((r) => r.status !== "open");
  const teams = [...new Set(open.map((r) => r.teamId ?? ""))];

  return (
    <div className="mx-auto flex w-full max-w-[960px] flex-col gap-6 px-4 py-8 sm:px-8">
      <PageHeader title="IT queue" subtitle={data ? `${plural(open.length, "open request")} tied to changes, earliest change date first` : "Access requests tied to changes"} />
      <p className="max-w-2xl text-sm text-faint">Ripple only asks. Grant access in your identity provider, then mark it granted here so the person is told and the gap closes.</p>
      {isGraphDown(error) && <GraphDownBanner onRetry={() => refetch()} />}
      {isPending && <LoadingBlock label="Loading the IT queue" />}
      {error && !isGraphDown(error) && <p role="alert" className="text-sm text-body">{error.message}</p>}
      {decide.isError && <p role="alert" className="text-sm text-body">{decide.error.message}</p>}
      {data && !all.length && (
        <div className={`${card} space-y-1 p-6`}>
          <h3 className="font-medium text-strong">No access requests</h3>
          <p className="text-body">When a change is confirmed, the Access Planner proposes requests for people who lack the software or access it needs. Approved ones land here.</p>
        </div>
      )}
      {teams.map((team) => {
        const rows = open.filter((r) => (r.teamId ?? "") === team);
        return (
          <section key={team || "none"} className="flex flex-col gap-3" aria-label={teamLabel(team || null)}>
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-medium text-faint">{teamLabel(team || null)} · {plural(rows.length, "request")}</h2>
              <button type="button" className={btn} disabled={!data?.canDecide || decide.isPending} title={data?.canDecide ? undefined : "Only an admin or team lead can decide."} onClick={() => decide.mutate({ ids: rows.map((r) => r.id), verb: "grant" })}>
                Mark all {rows.length} granted
              </button>
            </div>
            <ul className={card}>
              {rows.map((r) => <Row key={r.id} r={r} canDecide={!!data?.canDecide} busy={decide.isPending} onDecide={(verb) => decide.mutate({ ids: [r.id], verb })} />)}
            </ul>
          </section>
        );
      })}
      {done.length > 0 && (
        <section className="flex flex-col gap-3" aria-label="Decided">
          <h2 className="text-sm font-medium text-faint">Decided · {done.length}</h2>
          <ul className={card}>
            {done.map((r) => <Row key={r.id} r={r} canDecide={false} busy={false} onDecide={() => {}} />)}
          </ul>
        </section>
      )}
    </div>
  );
}
