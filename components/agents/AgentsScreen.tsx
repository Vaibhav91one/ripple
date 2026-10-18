"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { ClipboardCheck } from "lucide-react";
import { ago, btn, kindLabel, STATUS_TONE } from "@/components/approvals/shared";
import { PageHeader } from "@/components/shell/PageHeader";
import { GraphDownBanner, LoadingBlock } from "@/components/states/States";
import { AgentCard } from "@/components/ui/agent-card";
import { Pill } from "@/components/ui/tone";
import { getAgents, getApprovals, getRuns, isGraphDown, patchAgentSettings } from "@/lib/api";
import type { AgentInfo, RunSummary } from "@/lib/schemas";

const dur = (ms: number | null) => (ms === null ? "running" : ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`);
const tok = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n));

function Switch({ on, label, disabled, onChange }: { on: boolean; label: string; disabled?: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} disabled={disabled} onClick={() => onChange(!on)}
      className={`relative h-5 w-9 shrink-0 rounded-full border border-hairline outline-none transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ripple disabled:cursor-not-allowed disabled:opacity-50 ${on ? "bg-covered" : "bg-raised"}`}>
      <span className={`absolute left-0.5 top-0.5 size-3.5 rounded-full bg-strong transition-transform ${on ? "translate-x-4" : ""}`} />
    </button>
  );
}

function Roster({ a, canEdit, now, onPatch }: { a: AgentInfo; canEdit: boolean; now: number; onPatch: (p: { enabled?: boolean; autoApprove?: Record<string, boolean> }) => void }) {
  const last = a.lastRun;
  const tone = !a.enabled || !last || last.status === "running" ? "gap" : last.status === "done" ? "covered" : "conflict";
  return (
    <li className="min-w-0">
      <AgentCard
        size="sm"
        title={a.name} pill={!a.enabled ? "off" : last?.status ?? "idle"} pillTone={tone}
        folder={a.team === "everyone" ? "Everyone" : a.team} folderNote={`${a.runs24h} runs · 24h`}
        progress={0} agent={a.group} task={a.job || a.tools.slice(0, 4).join(", ") || "No tools"}
        glyph={a.enabled ? "●" : "○"} status={last ? `Last run ${ago(last.startedAt, now)}` : "Never run"}
        statusTone={a.enabled ? "body" : "gap"}
        footer={
          <details className="text-xs">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 outline-none focus-visible:outline-2 focus-visible:outline-ripple">
              <span className="text-strong">Enabled for this org</span>
              <Switch on={a.enabled} label={`${a.name} enabled`} disabled={!canEdit} onChange={(enabled) => onPatch({ enabled })} />
            </summary>
            <div className="mt-3 space-y-2">
              <p className="text-faint"><span className="text-body">Triggers</span> {a.triggers.length ? a.triggers.join(", ") : "on demand"}</p>
              {a.writes.length === 0 ? (
                <p className="text-faint">Read-only: it proposes nothing.</p>
              ) : (
                a.writes.map((k) => (
                  <label key={k} className="flex items-center justify-between gap-3">
                    <span className="text-body">Auto-approve <span className="text-strong">{kindLabel(k).toLowerCase()}</span></span>
                    <Switch on={a.autoApprove[k] ?? false} label={`Auto-approve ${kindLabel(k)}`} disabled={!canEdit} onChange={(v) => onPatch({ autoApprove: { [k]: v } })} />
                  </label>
                ))
              )}
              {!canEdit && <p className="text-faint">Only admins change these.</p>}
            </div>
          </details>
        }
      />
    </li>
  );
}

function RunRow({ r, now }: { r: RunSummary; now: number }) {
  return (
    <li>
      <Link href={`/agents/runs/${r.id}`} className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1 px-4 py-3 outline-none hover:bg-raised focus-visible:bg-raised focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ripple sm:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_72px_64px_56px_80px]">
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium text-strong">{r.agent}</span>
          <span className="block truncate text-xs text-faint">{r.trigger}</span>
        </span>
        <span className="justify-self-end sm:order-3 sm:justify-self-start"><Pill tone={STATUS_TONE[r.status] ?? "gap"} dot>{r.status}</Pill></span>
        <span className="col-span-2 flex gap-3 text-xs tabular-nums text-faint sm:contents">
          <span className="sm:order-2 sm:truncate">{r.error ?? `${r.proposals} ${r.proposals === 1 ? "proposal" : "proposals"}`}</span>
          <span className="sm:order-4 sm:text-right">{tok(r.tokens)} tok</span>
          <span className="sm:order-5 sm:text-right">{dur(r.durationMs)}</span>
          <span className="ml-auto sm:order-6 sm:text-right">{ago(r.startedAt, now)}</span>
        </span>
      </Link>
    </li>
  );
}

export function AgentsScreen() {
  const qc = useQueryClient();
  const [now] = useState(() => Date.now());
  const agents = useQuery({ queryKey: ["agents"], queryFn: getAgents });
  const runs = useQuery({ queryKey: ["runs"], queryFn: () => getRuns() });
  const open = useQuery({ queryKey: ["approvals", "open"], queryFn: () => getApprovals("open"), retry: false });
  const patch = useMutation({
    mutationFn: ({ name, ...p }: { name: string; enabled?: boolean; autoApprove?: Record<string, boolean> }) => patchAgentSettings(name, p),
    onSettled: () => void qc.invalidateQueries({ queryKey: ["agents"] }),
  });
  const canEdit = agents.data?.canEdit ?? false;
  const pending = open.data && !open.data.sample ? open.data.open : 0;
  const err = agents.error ?? runs.error;

  return (
    <div className="mx-auto flex w-full max-w-[1100px] flex-col gap-8 px-4 py-6 sm:px-8 sm:py-8">
      {isGraphDown(err) && <GraphDownBanner onRetry={() => { void agents.refetch(); void runs.refetch(); }} />}
      <PageHeader title="Agents" subtitle="Who works for your org, what they did, and what they are allowed to do on their own.">
        <Link href="/reports" className={btn}><ClipboardCheck size={14} aria-hidden />Approvals{pending ? <span className="rounded-full bg-gap-soft px-1.5 text-2xs text-gap">{pending}</span> : null}</Link>
      </PageHeader>
      {(agents.data?.note || runs.data?.note) && <p role="status" className="rounded-lg border border-hairline bg-raised px-4 py-3 text-sm text-body">{agents.data?.note ?? runs.data?.note}</p>}
      {patch.error && <p role="alert" className="text-sm text-conflict">{patch.error.message}</p>}

      <section aria-labelledby="roster" className="space-y-3">
        <h2 id="roster" className="text-sm font-medium text-strong">Roster</h2>
        {agents.isPending ? <LoadingBlock label="Loading agents" /> : (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {agents.data?.agents.map((a) => (
              <Roster key={a.name} a={a} canEdit={canEdit && !patch.isPending} now={now} onPatch={(p) => patch.mutate({ name: a.name, ...p })} />
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="runs" className="space-y-3">
        <h2 id="runs" className="text-sm font-medium text-strong">Recent runs</h2>
        {runs.isPending ? <LoadingBlock label="Loading runs" /> : !runs.data?.runs.length ? (
          <p className="rounded-card border border-dashed border-hairline p-6 text-sm text-faint">No runs yet. An agent run shows up here the moment it starts.</p>
        ) : (
          <ul className="divide-y divide-hairline overflow-hidden rounded-card border border-hairline bg-surface">
            {runs.data.runs.map((r) => <RunRow key={r.id} r={r} now={now} />)}
          </ul>
        )}
      </section>
    </div>
  );
}
