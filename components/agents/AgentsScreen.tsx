"use client";

import { useHydrated } from "@/lib/use-hydrated";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Bot, ChevronRight, ClipboardCheck, MessageCircle, Search, X } from "lucide-react";
import { ago, kindLabel } from "@/components/approvals/shared";
import { SAMPLE_RUN } from "@/lib/approvals/sample";
import { PageHeader } from "@/components/shell/PageHeader";
import { GraphDownBanner } from "@/components/states/States";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusPill } from "@/components/ui/status-pill";
import { getAgents, getApprovals, getRuns, isGraphDown, patchAgentSettings } from "@/lib/api";
import type { AgentInfo, RunSummary } from "@/lib/schemas";
import { AGENT_ART } from "./art";
import { AgentGrid, agentStatus, chatBtn, filterAgents, LOCK_REASON, type Lock, parseTeam, runTone, runWords, Switch, TEAM_FILTERS, teamLabel, type TeamFilter } from "./gallery";

const pill = "inline-flex h-10 items-center gap-2 rounded-control px-3.5 text-sm font-medium";
const chip = "inline-flex h-8 items-center rounded-full px-3 text-sm outline-none focus-visible:outline-2 focus-visible:outline-ripple";

const RUN_WORD: Record<string, string> = { done: "Done", running: "Running", failed: "Failed", queued: "Queued", budget: "Over budget" };
const howItRuns = (t: string[]) => (t.some((x) => x.startsWith("cron ")) ? "Runs on a schedule" : t.length ? "Runs on its own when something changes" : "Runs when you ask");

function RunRow({ r, now, href }: { r: RunSummary; now: number; href: string | null }) {
  const body = (
    <>
      <StatusPill tone={runTone(r.status, r.startedAt, now)}>{RUN_WORD[r.status] ?? r.status}</StatusPill>
      <span className="min-w-0 flex-1 truncate text-body">{r.proposals ? `${r.proposals} ${r.proposals === 1 ? "proposal" : "proposals"}` : "Nothing proposed"}</span>
      <span className="text-xs text-faint">{ago(r.startedAt, now)}</span>
    </>
  );
  return (
    <li>
      {href ? (
        <Link href={href} className="flex items-center gap-3 px-3 py-2.5 text-sm outline-none hover:bg-raised focus-visible:bg-raised">{body}<ChevronRight size={14} aria-hidden className="text-faint" /></Link>
      ) : <div className="flex items-center gap-3 px-3 py-2.5 text-sm">{body}</div>}
    </li>
  );
}

function Drawer({ a, now, lock, busy, onClose, onPatch }: { a: AgentInfo; now: number; lock: Lock; busy: boolean; onClose: () => void; onPatch: (p: { enabled?: boolean; autoApprove?: Record<string, boolean> }) => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { ref.current?.showModal(); }, []);
  const runs = useQuery({ queryKey: ["runs", a.name], queryFn: () => getRuns(a.name) });
  const sample = !!runs.data?.sample;
  // Sample runs belong to a demo agent, not this one; only the sample run that /api/agents/runs/[id] serves gets a link.
  const list = runs.data?.runs.slice(0, 8) ?? [];
  const Art = AGENT_ART[a.name];
  const st = agentStatus(a, now);
  return (
    <dialog ref={ref} onClose={onClose} aria-label={a.displayName} onClick={(e) => { if (e.target === ref.current) ref.current?.close(); }}
      className="m-0 ml-auto h-dvh max-h-dvh w-full max-w-[440px] overflow-y-auto border-l border-hairline bg-surface p-0 text-body backdrop:bg-strong/20">
      <div className="min-h-full p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-xl font-medium text-strong">{a.displayName}</h2>
          <p className="mt-1 text-md text-faint">{a.tagline}</p>
        </div>
        <button type="button" onClick={() => ref.current?.close()} aria-label="Close" className="grid size-9 shrink-0 place-items-center rounded-full border border-hairline text-body hover:bg-raised"><X size={16} aria-hidden /></button>
      </div>
      {Art && <Art className="mt-5 w-full" />}
      <dl className="mt-5 divide-y divide-hairline text-sm">
        <div className="flex items-center justify-between py-2.5"><dt className="text-faint">Works for</dt><dd className="text-strong">{teamLabel(a.team)}</dd></div>
        <div className="flex items-center justify-between py-2.5"><dt className="text-faint">Status</dt><dd><StatusPill tone={st.tone}>{st.label}</StatusPill></dd></div>
        <div className="flex items-center justify-between py-2.5"><dt className="text-faint">How it runs</dt><dd className="text-strong">{howItRuns(a.triggers)}</dd></div>
        <div className="flex items-center justify-between gap-4 py-2.5"><dt className="text-faint">On for this org</dt><dd><Switch on={a.enabled} label={`${a.displayName} on`} lock={lock} busy={busy} onChange={(enabled) => onPatch({ enabled })} /></dd></div>
        {a.writes.length === 0 ? (
          <p className="py-2.5 text-faint">Read-only: it never proposes an action.</p>
        ) : a.writes.map((k) => (
          <div key={k} className="flex items-center justify-between gap-4 py-2.5">
            <dt className="text-faint">Auto-approve {kindLabel(k).toLowerCase()}</dt>
            <dd><Switch on={a.autoApprove[k] ?? false} label={`Auto-approve ${kindLabel(k)}`} lock={lock} busy={busy} onChange={(v) => onPatch({ autoApprove: { [k]: v } })} /></dd>
          </div>
        ))}
      </dl>
      <Link href={`/?agent=${encodeURIComponent(a.name)}`} className={`${chatBtn} mt-4 w-full`}><MessageCircle size={14} aria-hidden />Chat with this agent</Link>

      <h3 className="mt-8 text-md font-medium text-strong">Recent runs</h3>
      <p className="mt-0.5 text-sm text-faint">{runWords(a, now)}</p>
      {runs.isPending ? <Skeleton className="mt-3 h-24" /> : !list.length ? (
        <p className="mt-3 rounded-inset bg-raised px-4 py-3 text-sm text-faint">No runs yet. A run shows up here the moment it starts.</p>
      ) : (
        <>
          {sample && <p className="mt-3 text-xs font-medium text-faint">Sample runs (not this agent)</p>}
          <ul className={`${sample ? "mt-1.5" : "mt-3"} divide-y divide-hairline rounded-inset border border-hairline`}>
            {list.map((r) => <RunRow key={r.id} r={r} now={now} href={!sample || r.id === SAMPLE_RUN.run.id ? `/agents/runs/${r.id}` : null} />)}
          </ul>
        </>
      )}
      </div>
    </dialog>
  );
}

export function AgentsScreen() {
  const qc = useQueryClient();
  const router = useRouter();
  const path = usePathname();
  const params = useSearchParams();
  const { team, unknown } = parseTeam(params.get("team"));
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [denied, setDenied] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [now] = useState(() => Date.now());
  const agents = useQuery({ queryKey: ["agents"], queryFn: getAgents });
  const approvals = useQuery({ queryKey: ["approvals", "open"], queryFn: () => getApprovals("open"), retry: false });
  const patch = useMutation({
    mutationFn: ({ name, ...p }: { name: string; enabled?: boolean; autoApprove?: Record<string, boolean> }) => patchAgentSettings(name, p),
    onMutate: ({ name }) => setBusy(name),
    onError: (e) => { if (/forbidden/i.test(e.message)) setDenied(true); },
    onSettled: () => { setBusy(null); void qc.invalidateQueries({ queryKey: ["agents"] }); },
  });
  const list = agents.data?.agents ?? [];
  const block = agents.data && !agents.data.canEdit ? agents.data.editBlock ?? "role" : denied ? "role" : null;
  const lock: Lock = agents.isPending ? LOCK_REASON.role : block ? LOCK_REASON[block] : null;
  const shown = filterAgents(list, q, team);
  const failedNow = list.filter((a) => a.lastRun?.status === "failed").length;
  const inTeam = filterAgents(list, "", team).length;
  const on = list.filter((a) => a.enabled).length;
  const ran = list.filter((a) => a.runs24h > 0).length;
  const hydrated = useHydrated(); // the shell may have filled the shared approvals query before this page hydrates
  const pending = hydrated && approvals.data && !approvals.data.sample ? approvals.data.open : 0;
  const setTeam = (id: TeamFilter | null) => router.replace(id ? `${path}?team=${id}` : path, { scroll: false });
  const current = list.find((a) => a.name === open);

  return (
    <div className="mx-auto w-full max-w-[1280px]">
      {isGraphDown(agents.error) && <GraphDownBanner onRetry={() => void agents.refetch()} />}
      <PageHeader title="Agents" subtitle={!agents.data ? "Who works for your org, and what they do." : team
          ? `${inTeam} ${inTeam === 1 ? "agent works" : "agents work"} for ${teamLabel(team)}, out of ${list.length} in your org.`
          : `${list.length} agents work for your org. ${on} are on and ${ran === 0 ? "none" : ran} ran in the last day.`}>
        <label className={`${pill} w-full border border-hairline bg-surface text-faint focus-within:outline-2 focus-within:outline-ripple sm:w-64`}>
          <Search size={15} aria-hidden />
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search agents" aria-label="Search agents by name, team or job"
            className="min-w-0 flex-1 bg-transparent text-strong outline-none placeholder:text-faint" />
        </label>
        <Link href="/reports" className={`${pill} bg-raised text-strong hover:bg-hairline`}>
          <ClipboardCheck size={15} aria-hidden className="text-body" />Approvals
          {pending ? <span className="rounded-full bg-gap-soft px-1.5 text-xs text-strong">{pending}</span> : null}
        </Link>
      </PageHeader>

      <div role="group" aria-label="Filter by team" className="-mx-1 mb-5 flex gap-1.5 relative overflow-x-auto px-1 pb-1">
        {[[null, "All"] as const, ...TEAM_FILTERS].map(([id, label]) => (
          <button key={label} type="button" aria-pressed={team === id} onClick={() => setTeam(id)}
            className={`${chip} shrink-0 ${team === id ? "bg-strong font-medium text-ink-on-strong" : "bg-raised text-body hover:bg-hairline"}`}>{label}</button>
        ))}
      </div>

      {unknown && <p role="status" className="mb-4 text-sm text-faint">Unknown team, showing all.</p>}
      {agents.data?.note && <p role="status" className="mb-4 rounded-inset bg-raised px-4 py-3 text-sm text-body">{agents.data.note}</p>}
      {patch.error && !denied && <p role="alert" className="mb-4 text-sm text-conflict-ink">{patch.error.message}</p>}

      {failedNow > 3 && <p role="status" className="mb-4 rounded-inset bg-gap-soft px-4 py-3 text-sm text-gap-ink">{failedNow} agents failed their last run. Open one to see why.</p>}

      {agents.isPending ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{Array.from({ length: 8 }, (_, i) => <Skeleton key={i} className="h-80 rounded-card" />)}</div>
      ) : shown.length === 0 ? (
        q || team ? (
          <EmptyState icon={Bot} title="No agent matches">
            {q ? `Nothing matches "${q}"${team ? ` for ${teamLabel(team)}` : ""}.` : `No agent works for ${teamLabel(team ?? "")} yet.`} Try another word or team.
          </EmptyState>
        ) : (
          <EmptyState icon={Bot} title="No agents yet">No agents are set up for this org yet.</EmptyState>
        )
      ) : (
        <AgentGrid agents={shown} now={now} lock={lock} busy={busy} onOpen={setOpen} onToggle={(name, enabled) => patch.mutate({ name, enabled })} />
      )}

      {current && <Drawer key={current.name} a={current} now={now} lock={lock} busy={busy === current.name} onClose={() => setOpen(null)} onPatch={(p) => patch.mutate({ name: current.name, ...p })} />}
    </div>
  );
}
