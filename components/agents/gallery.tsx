// Agent gallery pieces: the team filter, plain-words status, and the card grid. Pure (no data fetching) so tests can render it.
import Link from "next/link";
import { MessageCircle } from "lucide-react";
import { StatusPill, type StatusTone } from "@/components/ui/status-pill";
import { ago } from "@/components/approvals/shared";
import type { AgentInfo } from "@/lib/schemas";
import { AGENT_ART } from "./art";

export const TEAM_FILTERS = [
  ["legal", "Legal"], ["sales", "Sales"], ["security", "Security"], ["devrel", "DevRel"],
  ["support", "Support"], ["leadership", "Leadership"], ["it", "IT"], ["everyone", "Everyone"],
] as const;
export type TeamFilter = (typeof TEAM_FILTERS)[number][0];
export const isTeamFilter = (t: string | null | undefined): t is TeamFilter => TEAM_FILTERS.some(([id]) => id === t);

/** The Impact Analyst works for whoever owns a change, so it sits under Everyone. */
const filterOf = (team: string) => (team === "change-owner" ? "everyone" : team);
export const teamLabel = (team: string) => (team === "change-owner" ? "Change owners" : TEAM_FILTERS.find(([id]) => id === team)?.[1] ?? team);

/** Gallery order: the flagship first, then roughly the order a change travels through Ripple. */
const ORDER = ["impact", "ask", "contract", "exposure", "advisor", "support", "docs", "security", "access", "digest"];
const rank = (name: string) => (ORDER.indexOf(name) + 1 || ORDER.length + 1);

export function filterAgents<T extends Pick<AgentInfo, "name" | "displayName" | "tagline" | "team">>(list: readonly T[], q: string, team: TeamFilter | null): T[] {
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  return list.filter((a) => {
    if (team && filterOf(a.team) !== team) return false;
    const hay = `${a.displayName} ${a.tagline} ${teamLabel(a.team)}`.toLowerCase();
    return words.every((w) => hay.includes(w));
  }).sort((a, b) => rank(a.name) - rank(b.name));
}

/** Neutral unless something is really happening: running is teal, a failed or over-budget last run is amber. */
export function agentStatus(a: Pick<AgentInfo, "enabled" | "lastRun">): { tone: StatusTone; label: string } {
  if (!a.enabled) return { tone: "neutral", label: "Off" };
  const s = a.lastRun?.status;
  if (s === "running") return { tone: "ripple", label: "Running" };
  if (s === "failed" || s === "budget") return { tone: "gap", label: "Needs a look" };
  return { tone: "neutral", label: "Idle" };
}

export function runWords(a: Pick<AgentInfo, "lastRun" | "runs24h">, now: number): string {
  const last = a.lastRun ? `Last ran ${ago(a.lastRun.startedAt, now)}` : "Hasn't run yet";
  const n = a.runs24h;
  return `${last} · ${n === 0 ? "no runs" : n === 1 ? "1 run" : `${n} runs`} in the last day`;
}

export function Switch({ on, label, disabled, onChange }: { on: boolean; label: string; disabled?: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} disabled={disabled} onClick={() => onChange(!on)}
      className={`relative h-5 w-9 shrink-0 rounded-full outline-none transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ripple disabled:cursor-not-allowed disabled:opacity-50 ${on ? "bg-strong" : "bg-hairline"}`}>
      <span className={`absolute left-0.5 top-0.5 size-4 rounded-full bg-surface shadow-sm transition-transform ${on ? "translate-x-4" : ""}`} />
    </button>
  );
}

/** Switch with the read-only reason as a tooltip (a disabled button gets no hover events, so the title sits on the wrapper). */
export function AgentSwitch({ a, readOnly, onToggle }: { a: AgentInfo; readOnly: boolean; onToggle: (on: boolean) => void }) {
  return (
    <span title={readOnly ? "Read-only demo" : undefined} className="inline-flex">
      <Switch on={a.enabled} label={`${a.displayName} on`} disabled={readOnly} onChange={onToggle} />
    </span>
  );
}

export const chatBtn = "inline-flex h-9 items-center justify-center gap-1.5 rounded-control border border-hairline bg-surface px-3 text-sm font-medium text-strong outline-none hover:bg-raised focus-visible:outline-2 focus-visible:outline-ripple";

export function AgentTile({ a, now, readOnly, onOpen, onToggle }: { a: AgentInfo; now: number; readOnly: boolean; onOpen: () => void; onToggle: (on: boolean) => void }) {
  const Art = AGENT_ART[a.name];
  const st = agentStatus(a);
  return (
    <li className="flex min-w-0 gap-4 rounded-card border border-hairline bg-surface p-3 sm:flex-col sm:pb-4">
      {Art && <Art className="w-[104px] shrink-0 self-start sm:w-full" />}
      <div className="flex min-w-0 flex-1 flex-col sm:px-2">
        <div className="flex items-start justify-between gap-3">
          <h3 className="min-w-0 text-md font-medium leading-6 text-strong">
            <button type="button" onClick={onOpen} className="text-left outline-none hover:underline hover:decoration-hairline hover:underline-offset-4 focus-visible:outline-2 focus-visible:outline-ripple">
              {a.displayName}
            </button>
          </h3>
          <AgentSwitch a={a} readOnly={readOnly} onToggle={onToggle} />
        </div>
        <p className="mt-1 text-sm leading-5 text-body">{a.tagline}</p>
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <span className="inline-flex h-6 items-center rounded-full bg-raised px-2.5 text-xs font-medium text-body">{teamLabel(a.team)}</span>
          <StatusPill tone={st.tone}>{st.label}</StatusPill>
        </div>
        <p className="mt-2 text-xs text-faint">{runWords(a, now)}</p>
        <div className="mt-4 flex gap-2 sm:mt-auto sm:pt-4">
          <Link href={`/?agent=${encodeURIComponent(a.name)}`} className={`${chatBtn} flex-1`}><MessageCircle size={14} aria-hidden />Chat with this agent</Link>
        </div>
      </div>
    </li>
  );
}

export function AgentGrid({ agents, now, readOnly, onOpen, onToggle }: { agents: AgentInfo[]; now: number; readOnly: boolean; onOpen: (name: string) => void; onToggle: (name: string, on: boolean) => void }) {
  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {agents.map((a) => <AgentTile key={a.name} a={a} now={now} readOnly={readOnly} onOpen={() => onOpen(a.name)} onToggle={(on) => onToggle(a.name, on)} />)}
    </ul>
  );
}
