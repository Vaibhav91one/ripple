"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence } from "motion/react";
import { parseAsString, useQueryState } from "nuqs";
import { useEffect, useMemo, useState } from "react";
import { ChevronRight, Inbox } from "lucide-react";
import { PageHeader } from "@/components/shell/PageHeader";
import { GraphDownBanner, LoadingBlock } from "@/components/states/States";
import { ActionToast } from "@/components/ui/action-toast";
import { Pill } from "@/components/ui/tone";
import { decideApproval, getApprovals, isGraphDown } from "@/lib/api";
import type { ApprovalRow } from "@/lib/schemas";
import { ApprovalDrawer, type Decision } from "./ApprovalDrawer";
import { ago, btn, kindLabel, STATUS_TONE, useNames } from "./shared";

type Toast = { id: number; title: string; body: string };
type Section = { key: string; kind: string; group: string | null; rows: ApprovalRow[] };

/** Rows of one kind and change sit together under a header that can approve them all. */
function sections(rows: ApprovalRow[]): Section[] {
  const out: Section[] = [];
  const by = new Map<string, Section>();
  for (const r of rows) {
    const key = r.group && r.groupSize > 1 ? `${r.kind}\0${r.group}` : r.id;
    let s = by.get(key);
    if (!s) {
      s = { key, kind: r.kind, group: key === r.id ? null : r.group, rows: [] };
      out.push(s);
      by.set(key, s);
    }
    s.rows.push(r);
  }
  return out;
}

const decidable = (r: ApprovalRow) => r.canDecide && r.status === "pending";

/** `changeId` scopes the list to one change and drops the page header (the Approvals tab of /changes/[id]). */
export function ApprovalsScreen({ changeId, drawerOnly }: { changeId?: string; drawerOnly?: boolean } = {}) {
  const qc = useQueryClient();
  const { name, title } = useNames();
  const [tab, setTab] = useState<"open" | "decided">("open");
  const [sel, setSel] = useQueryState("a", parseAsString);
  const [now] = useState(() => Date.now());
  const [toast, setToast] = useState<Toast>();
  const { data, isPending, error, refetch } = useQuery({ queryKey: ["approvals", tab, changeId ?? null], queryFn: () => getApprovals(tab, changeId) });
  const rows = useMemo(() => data?.approvals ?? [], [data]);
  const secs = useMemo(() => sections(rows), [rows]);
  const row = rows.find((r) => r.id === sel);
  // keep the last row rendered while the drawer animates out
  const [shown, setShown] = useState(row);
  if (row && row !== shown) setShown(row);

  const decide = useMutation({
    mutationFn: ({ id, ...d }: Decision & { id: string }) => decideApproval(id, d.decision, { note: d.note, bulk: d.bulk }),
    onSuccess: (res, v) => {
      const done = res.results.filter((r) => r.changed).length;
      const verb = v.decision === "approve" ? "Approved" : "Rejected";
      setToast((t) => ({ id: (t?.id ?? 0) + 1, title: done > 1 ? `${verb} ${done} actions` : done ? `${verb}` : "Already decided", body: done > 1 ? "They are queued to run, one by one." : v.decision === "approve" ? "Queued to run. A failure will show up here." : "Nothing was changed." }));
      setSel(null);
      void qc.invalidateQueries({ queryKey: ["approvals"] });
    },
  });
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(undefined), 7000);
    return () => clearTimeout(t);
  }, [toast]);
  const run = (id: string, d: Decision) => decide.mutate({ id, ...d });
  const sibs = (r: ApprovalRow) => (decidable(r) ? rows.filter((x) => x.id !== r.id && decidable(x) && x.kind === r.kind && x.group === r.group && r.group).length : 0);

  const open = data?.open ?? 0;
  const empty = data?.note ?? (tab === "open" ? "Nothing waiting on you. Agents and connectors propose; you decide." : "No decisions yet.");

  return (
    <div className={drawerOnly ? undefined : changeId ? "mx-auto flex w-full max-w-[960px] flex-col gap-6" : "mx-auto flex w-full max-w-[960px] flex-col gap-6 px-4 py-6 sm:px-8 sm:py-8"}>
      {!drawerOnly && <>
      {isGraphDown(error) && <GraphDownBanner onRetry={() => void refetch()} />}
      <PageHeader title={changeId ? "Waiting for approval" : "Approvals"} subtitle={data?.sample ? "Sample proposals" : changeId ? `${rows.length} on this change` : `${open} waiting for a decision`}>
        <div role="tablist" aria-label="Show" className="flex gap-1 rounded-lg border border-hairline bg-surface p-0.5 text-sm">
          {(["open", "decided"] as const).map((t) => (
            <button key={t} role="tab" aria-selected={tab === t} type="button" onClick={() => setTab(t)}
              className={`rounded-md px-3 py-1 outline-none focus-visible:outline-2 focus-visible:outline-ripple ${tab === t ? "bg-raised text-strong" : "text-faint hover:text-body"}`}>
              {t === "open" ? "Open" : "History"}
            </button>
          ))}
        </div>
      </PageHeader>

      {data?.note && !data.sample && <p role="status" className="rounded-lg border border-hairline bg-raised px-4 py-3 text-sm text-body">{data.note}</p>}
      {data?.sample && <p role="status" className="rounded-lg border border-hairline bg-raised px-4 py-3 text-sm text-body">{data.note} You can read everything here; deciding is for signed-in members.</p>}
      {isPending && <LoadingBlock label="Loading proposals" />}
      {decide.error && !row && <p role="alert" className="text-sm text-conflict-ink">{decide.error.message}</p>}

      {data && !rows.length && (
        <div className="flex flex-col items-center gap-2 rounded-card border border-dashed border-hairline px-6 py-14 text-center">
          <Inbox aria-hidden className="size-5 text-faint" />
          <p className="max-w-sm text-sm text-faint">{empty}</p>
        </div>
      )}

      <div className="space-y-5">
        {secs.map((s) => {
          const ready = s.rows.filter(decidable);
          return (
            <section key={s.key} aria-label={s.group ? `${kindLabel(s.kind)} from ${s.group}` : undefined}>
              {s.group && (
                <header className="mb-2 flex flex-wrap items-center justify-between gap-2 px-1">
                  <h2 className="min-w-0 text-xs text-faint [overflow-wrap:anywhere]"><span className="font-medium text-body">{s.rows.length} {kindLabel(s.kind).toLowerCase()}s</span> from <span className="font-mono">{s.group}</span></h2>
                  {ready.length > 1 && (
                    <button type="button" disabled={decide.isPending} onClick={() => run(ready[0].id, { decision: "approve", bulk: true })} className={btn}>Approve all {ready.length}</button>
                  )}
                </header>
              )}
              <ul className="divide-y divide-hairline overflow-hidden rounded-card border border-hairline bg-surface">
                {s.rows.map((r) => (
                  <li key={r.id}>
                    <button type="button" onClick={() => setSel(r.id)} aria-label={`Open: ${title(r)}`}
                      className="group flex w-full items-center gap-3 px-4 py-3 text-left outline-none hover:bg-raised focus-visible:bg-raised focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ripple">
                      <span className="hidden w-28 shrink-0 font-mono text-2xs text-faint sm:block">{kindLabel(r.kind)}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-strong">{title(r)}</span>
                        <span className="mt-0.5 block truncate text-xs text-faint">
                          <span className="sm:hidden">{kindLabel(r.kind)} · </span>{r.proposer}{r.changeId ? ` · ${name(r.changeId)}` : r.group ? ` · ${r.group}` : ""}
                        </span>
                      </span>
                      {r.status !== "pending" && <Pill tone={STATUS_TONE[r.status] ?? "gap"} dot>{r.status}</Pill>}
                      <span className="w-16 shrink-0 text-right text-xs text-faint">{ago(r.decidedAt ?? r.requestedAt, now)}</span>
                      <ChevronRight aria-hidden className="size-4 shrink-0 text-faint group-hover:text-body" />
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
      </>}

      {shown && (
          <ApprovalDrawer
            key={shown.id} open={!!row} row={shown} now={now} siblings={sibs(shown)} busy={decide.isPending} error={decide.error?.message}
            readOnly={data?.sample ? "Sample data is read-only." : shown.canDecide ? undefined : shown.status === "pending" || shown.status === "failed" ? "Your role can't decide this kind of action." : undefined}
            onDecide={(d) => run(shown.id, d)} onClose={() => { decide.reset(); void setSel(null); }}
          />
      )}

      <div className="fixed right-4 top-16 z-50">
        <AnimatePresence>
          {toast && <ActionToast key={toast.id} {...toast} time="Just now" action="History" dismiss="Dismiss" onAction={() => { setTab("decided"); setToast(undefined); }} onDismiss={() => setToast(undefined)} />}
        </AnimatePresence>
      </div>
    </div>
  );
}
