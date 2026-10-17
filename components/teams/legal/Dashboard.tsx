"use client";

import Link from "next/link";
import { parseAsStringLiteral, useQueryState } from "nuqs";
import { ContextCard } from "@/components/kit/beautifului/context-cards";
import { TaskList } from "@/components/kit/rareui/task-list";
import { Segmented } from "@/components/kit/obsidian/analytics/segmented";
import { StatusPill } from "@/components/kit/obsidian/analytics/status-pill";
import type { Tone } from "@/components/kit/obsidian/analytics/tone";
import { useSourcePanel } from "@/components/panels/SourcePanel";
import type { Clause, Contract } from "@/lib/schemas";
import { obligations, renewalsWithin } from "@/lib/teams/legal/schema";
import { TeamFrame, TeamState, Widget } from "../TeamFrame";
import { fmtDay, formatKpi } from "../format";
import { useNames, useTeamDashboard } from "../useTeamDashboard";

const DAY = 86400;
const WINDOWS = ["30", "60", "90"] as const;
const RISK_TONE: Record<Clause["risk"], Tone> = { high: "conflict", med: "gap", low: "neutral" };
const RISK_RANK: Record<Clause["risk"], number> = { high: 3, med: 2, low: 1 };
const STEPS: { id: Contract["approvalState"]; label: string }[] = [
  { id: "draft", label: "Draft" },
  { id: "in_review", label: "In review" },
  { id: "approved", label: "Approved" },
  { id: "signed", label: "Signed" },
];
const th = "px-2 py-1.5 text-left text-[11px] font-medium uppercase tracking-wide text-faint";
const td = "px-2 py-2 align-middle";

// Legal workspace: an Ironclad-style renewal window, obligations, clause risk and approval layers.
export function LegalDashboard() {
  const q = useTeamDashboard("legal");
  const name = useNames();
  const panel = useSourcePanel();
  const [win, setWin] = useQueryState("window", parseAsStringLiteral(WINDOWS).withDefault("90"));
  if (!q.data) return <TeamState error={q.error} onRetry={() => q.refetch()} />;
  const d = q.data;
  const days = Number(win);
  const contractOf = (id: string) => d.contracts.find((c) => c.id === id);
  const renewals = renewalsWithin(d.contracts, d.now, days);
  const total = renewals.reduce((s, c) => s + c.value, 0);
  const duties = obligations(d.clauses);
  const flagged = d.clauses.filter((c) => c.risk !== "low").sort((a, b) => RISK_RANK[b.risk] - RISK_RANK[a.risk] || Number(b.v1Related) - Number(a.v1Related));

  return (
    <TeamFrame title="Legal" subtitle="Contracts, renewals, obligations and clause risk" kpis={d.kpis} angle={d.angle} teamName="Legal">
      <Widget
        title="Renewal window"
        wide
        meta={<Segmented label="Renewal window" value={win} onChange={(v) => void setWin(v)} options={WINDOWS.map((w) => ({ id: w, label: `${w} days` }))} />}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr><th className={th}>Contract</th><th className={th}>Counterparty</th><th className={th}>Value</th><th className={th}>Notice</th><th className={th}>Renews</th></tr></thead>
            <tbody className="divide-y divide-hairline">
              {renewals.map((c) => {
                const noticeBy = c.endsAt - c.noticeDays * DAY;
                const late = noticeBy < d.now;
                return (
                  <tr key={c.id}>
                    <td className={`${td} text-strong`}>{c.name}</td>
                    <td className={`${td} text-body`}>{name(c.customerId)}</td>
                    <td className={`${td} tabular-nums text-body`}>{formatKpi("usd", c.value)}</td>
                    <td className={td}>
                      <span className="tabular-nums text-body">{c.noticeDays}d</span>{" "}
                      <span className={late ? "text-conflict" : "text-faint"}>{late ? "window passed" : `by ${fmtDay(noticeBy)}`}</span>
                    </td>
                    <td className={`${td} tabular-nums text-body`}>{fmtDay(c.endsAt)}</td>
                  </tr>
                );
              })}
              {renewals.length === 0 && <tr><td className={`${td} text-faint`} colSpan={5}>No renewals in this window.</td></tr>}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-faint">{renewals.length} renewing in {days} days · {formatKpi("usd", total)} contract value</p>
      </Widget>

      <Widget title="Obligations" meta={`${duties.length} open`}>
        <TaskList
          size="sm"
          className="w-full"
          defaultTasks={duties.map((c) => ({ id: c.id, label: `${c.title} · ${name(contractOf(c.contractId)?.customerId)} · due ${fmtDay(c.dueAt!)}` }))}
        />
      </Widget>

      <Widget title="Approval layers" meta={`${d.contracts.length} contracts`}>
        <ol className="grid grid-cols-2 gap-2">
          {STEPS.map((s, i) => {
            const rows = d.contracts.filter((c) => c.approvalState === s.id);
            return (
              <li key={s.id} className="flex min-w-0 flex-col gap-1.5 rounded-md bg-page p-2">
                <span className="flex items-baseline justify-between text-xs">
                  <span className="font-medium text-strong">{i + 1}. {s.label}</span>
                  <span className="tabular-nums text-faint">{rows.length}</span>
                </span>
                {rows.map((c) => <span key={c.id} className="truncate text-xs text-body">{c.name}</span>)}
              </li>
            );
          })}
        </ol>
      </Widget>

      <Widget title="Clause risk flags" wide meta={`${flagged.length} flagged`}>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {flagged.map((c, i) => {
            const conflict = c.number === "7.2" && c.v1Related;
            return (
              <div key={c.id} className={conflict ? "rounded-xl ring-1 ring-conflict" : undefined}>
                <ContextCard index={i} title={`${c.number} ${c.title}`} meta={<StatusPill tone={RISK_TONE[c.risk]} label={c.risk} />}>
                  <div className="flex flex-col gap-2 p-3">
                    <p className="text-xs text-faint">{contractOf(c.contractId)?.name}{c.dueAt && ` · due ${fmtDay(c.dueAt)}`}</p>
                    <button
                      type="button"
                      onClick={() => panel.open(c.src.artifactId, c.src.quote)}
                      className="rounded-md border-l-2 border-hairline bg-page px-3 py-2 text-left text-xs italic text-body hover:bg-raised transition-colors"
                    >
                      &ldquo;{c.src.quote}&rdquo;
                    </button>
                    {conflict && (
                      <p className="text-xs text-conflict">
                        Conflicts with the sunset decision.{" "}
                        <Link href="?conflict=open" className="underline underline-offset-2">Open the conflict</Link>
                      </p>
                    )}
                  </div>
                </ContextCard>
              </div>
            );
          })}
        </div>
      </Widget>
    </TeamFrame>
  );
}
