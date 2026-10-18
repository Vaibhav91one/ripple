"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { StatusPill } from "@/components/kit/obsidian/analytics/status-pill";
import type { Tone } from "@/components/kit/obsidian/analytics/tone";
import { getOverview } from "@/lib/api";
import type { Goal } from "@/lib/schemas";
import { TeamFrame, TeamState, Widget } from "../TeamFrame";
import { fmtDay } from "../format";
import { useNames, useTeamDashboard } from "../useTeamDashboard";

const DAY = 86400;
const STATUS: Record<Goal["status"], { label: string; tone: Tone; bar: string }> = {
  on_track: { label: "On track", tone: "covered", bar: "bg-covered" },
  at_risk: { label: "At risk", tone: "gap", bar: "bg-gap" },
  off_track: { label: "Off track", tone: "conflict", bar: "bg-conflict" },
};
const score = (r: { likelihood: number; impact: number }) => r.likelihood * r.impact;
const th = "px-2 py-1.5 text-left text-2xs font-medium uppercase tracking-wide text-faint";
const td = "px-2 py-2 align-middle";

// Leadership workspace: an Asana Goals-style grid, cross-team blockers, the risk register and open decisions.
export function LeadershipDashboard() {
  const q = useTeamDashboard("leadership");
  const name = useNames();
  const overview = useQuery({ queryKey: ["overview"], queryFn: getOverview });
  if (!q.data) return <TeamState error={q.error} onRetry={() => q.refetch()} />;
  const d = q.data;
  const goalOf = (id: string) => d.goals.find((g) => g.id === id);
  const blockerOf = (goalId: string) => d.blockers.find((b) => b.fromId === goalId);
  const risks = [...d.risks].sort((a, b) => score(b) - score(a));
  const blockers = [...d.blockers].sort((a, b) => a.since - b.since);
  const notTold = (id: string) => overview.data?.openDecisions.find((o) => o.decision.id === id)?.notTold.length ?? 0;
  const open = d.decisions.filter((x) => x.status !== "superseded");
  const age = (since: number) => `${Math.max(1, Math.round((d.now - since) / DAY))}d`;
  // Blocked goals read "Goal title" → team; a blocker's target may be a decision, finding or task.
  const target = (id: string) => {
    if (id.startsWith("d-")) return d.decisions.find((x) => x.id === id)?.title ?? id;
    const n = name(id);
    return n !== id ? n : id.replace(/^(\w+)-(\d+)$/, "$1 #$2"); // finding-1 → "finding #1"
  };

  return (
    <TeamFrame title="Leadership" subtitle="Company goals, blockers, risks and open decisions" kpis={d.kpis} angle={d.angle} restricted={d.restricted} teamName="Leadership">
      <Widget title="Goals" wide meta={`${d.goals.length} goals`}>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {d.goals.map((g) => {
            const s = STATUS[g.status];
            const b = blockerOf(g.id);
            return (
              <article key={g.id} className="flex flex-col gap-2.5 rounded-lg border border-hairline bg-page p-3">
                <header className="flex items-start justify-between gap-2">
                  <h3 className="text-sm font-medium text-strong">{g.title}</h3>
                  <StatusPill className="shrink-0" tone={s.tone} label={s.label} />
                </header>
                <p className="text-xs text-faint">{name(g.ownerTeamId)}</p>
                <div className="flex items-center gap-2" role="img" aria-label={`${g.progress}% complete`}>
                  <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-raised"><span className={`block h-full rounded-full ${s.bar}`} style={{ width: `${g.progress}%` }} /></span>
                  <span className="text-xs tabular-nums text-body">{g.progress}%</span>
                </div>
                {b && (
                  <p className="text-xs text-conflict-ink">
                    Blocked by{" "}
                    {b.toId.startsWith("d-")
                      ? <Link href={`/changes/${b.toId}`} className="underline underline-offset-2">{target(b.toId)}</Link>
                      : target(b.toId)}
                    {" "}· {age(b.since)}
                  </p>
                )}
              </article>
            );
          })}
        </div>
      </Widget>

      <Widget title="Cross-team blockers" meta={`${blockers.length} open`}>
        <ul className="flex flex-col divide-y divide-hairline">
          {blockers.map((b) => {
            const g = goalOf(b.fromId);
            return (
              <li key={b.fromId + b.toId} className="flex items-center gap-3 py-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-strong">{g?.title ?? name(b.fromId)}</p>
                  <p className="text-xs text-faint">{name(g?.ownerTeamId)} waits on {target(b.toId)} · since {fmtDay(b.since)}</p>
                </div>
                <StatusPill tone={Number(age(b.since).slice(0, -1)) >= 7 ? "conflict" : "gap"} label={age(b.since)} />
              </li>
            );
          })}
        </ul>
      </Widget>

      <Widget title="Open decisions" meta={`${open.length} open`}>
        <ul className="flex flex-col divide-y divide-hairline">
          {open.map((x) => (
            <li key={x.id} className="flex items-center gap-3 py-2">
              <div className="min-w-0 flex-1">
                <Link href={`/changes/${x.id}`} className="block truncate text-sm text-strong underline-offset-2 hover:underline transition-colors">{x.title}</Link>
                <p className="text-xs text-faint">{x.status} · decided {fmtDay(x.decidedAt)}</p>
              </div>
              {notTold(x.id) > 0 && <StatusPill tone="conflict" label={`${notTold(x.id)} teams not told`} />}
            </li>
          ))}
        </ul>
      </Widget>

      <Widget title="Risk register" wide meta="Likelihood × impact">
        <div className="relative overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr><th className={th}>Score</th><th className={th}>Risk</th><th className={th}>Owner</th><th className={th}>Team</th><th className={th}>Status</th></tr></thead>
            <tbody className="divide-y divide-hairline">
              {risks.map((r) => (
                <tr key={r.id}>
                  <td className={td}><StatusPill tone={score(r) >= 15 ? "conflict" : score(r) >= 9 ? "gap" : "neutral"} label={`${r.likelihood}×${r.impact} = ${score(r)}`} /></td>
                  <td className={`${td} text-strong`}>{r.title}{r.v1Related && <StatusPill className="ml-2" tone="ripple" label="v1 sunset" />}</td>
                  <td className={`${td} text-body`}>{name(r.ownerId)}</td>
                  <td className={`${td} text-body`}>{name(r.teamId)}</td>
                  <td className={`${td} capitalize text-body`}>{r.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Widget>
    </TeamFrame>
  );
}
