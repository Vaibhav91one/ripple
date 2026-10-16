"use client";

import { parseAsStringLiteral, useQueryState } from "nuqs";
import FilterTable, { type FilterColumn } from "@/components/kit/beautifului/filter-table";
import { Avatar } from "@/components/kit/obsidian/analytics/avatar";
import { Segmented } from "@/components/kit/obsidian/analytics/segmented";
import { Sparkline } from "@/components/kit/obsidian/analytics/sparkline";
import { StatusPill } from "@/components/kit/obsidian/analytics/status-pill";
import type { Tone } from "@/components/kit/obsidian/analytics/tone";
import type { TicketRow } from "@/lib/schemas";
import { fmtSla, slaState } from "@/lib/teams/support/schema";
import { TeamFrame, TeamState, Widget } from "../TeamFrame";
import { fmtDay, formatKpi } from "../format";
import { useNames, useTeamDashboard } from "../useTeamDashboard";

const VIEWS = ["all", "unassigned", "mine", "at_risk"] as const;
const PRIORITY_TONE: Record<TicketRow["priority"], Tone> = { urgent: "conflict", high: "gap", normal: "neutral", low: "neutral" };
const SLA_TONE = { breached: "text-conflict", risk: "text-gap", ok: "text-body", met: "text-covered" } as const;

// Support workspace: a Zendesk-style queue, Gainsight-style account health, and the CSAT trend.
export function SupportDashboard() {
  const q = useTeamDashboard("support");
  const name = useNames();
  const [view, setView] = useQueryState("view", parseAsStringLiteral(VIEWS).withDefault("all"));
  if (!q.data) return <TeamState error={q.error} onRetry={() => q.refetch()} />;
  const d = q.data;
  const now = d.now;
  const me = d.people[0]?.id;
  const open = d.tickets
    .filter((t) => t.status === "open")
    .sort((a, b) => (a.firstResponseAt === null ? a.slaDueAt : Infinity) - (b.firstResponseAt === null ? b.slaDueAt : Infinity));
  const sla = (t: TicketRow) => slaState(t, now);
  const matches = (t: TicketRow, key: string) =>
    key === "unassigned" ? t.firstResponseAt === null // nobody has picked it up yet
    : key === "mine" ? t.assigneeId === me
    : key === "at_risk" ? sla(t).kind === "breached" || sla(t).kind === "risk"
    : true;
  const count = (key: string) => open.filter((t) => matches(t, key)).length;
  const columns: FilterColumn<TicketRow>[] = [
    { header: "Subject", cell: (t) => <span className="font-medium text-strong">{t.title}</span> },
    { header: "Customer", cell: (t) => <span className="text-body">{name(t.customerId) || "No account"}</span> },
    { header: "Priority", cell: (t) => <StatusPill tone={PRIORITY_TONE[t.priority]} label={t.priority} className="capitalize" /> },
    { header: "Assignee", cell: (t) => <span className="flex items-center gap-1.5"><Avatar name={name(t.assigneeId)} size={22} />{name(t.assigneeId)}</span> },
    { header: "SLA", cell: (t) => <span className={`tabular-nums ${SLA_TONE[sla(t).kind]}`}>{fmtSla(sla(t))}</span> },
    { header: "", cell: (t) => (t.v1Related ? <StatusPill tone="gap" label="v1" /> : null) },
  ];

  const accounts = d.customers
    .map((c) => ({ c, v1: d.v1CustomerIds.includes(c.id), risk: (c.arr * (100 - c.healthScore)) / 100 }))
    .filter((x) => x.c.healthScore < 60 || (x.v1 && x.c.tier === "enterprise"))
    .sort((a, b) => b.risk - a.risk)
    .slice(0, 7);
  const arrAtRisk = accounts.reduce((s, x) => s + x.c.arr, 0);
  const csat = d.csat;

  return (
    <TeamFrame title="Support" subtitle="Queue, SLAs and customer health" kpis={d.kpis} angle={d.angle} teamName="Support">
      <Widget
        title="Queue"
        wide
        meta={
          <Segmented
            label="Queue view"
            value={view}
            onChange={(v) => void setView(v)}
            options={[
              { id: "all", label: `All ${count("all")}` },
              { id: "unassigned", label: `Unassigned ${count("unassigned")}` },
              { id: "mine", label: `Mine ${count("mine")}` },
              { id: "at_risk", label: `At risk ${count("at_risk")}` },
            ]}
          />
        }
      >
        <div className="max-h-[440px] overflow-y-auto rounded-xl">
        <FilterTable<TicketRow>
          filters={[]}
          columns={columns}
          rows={open}
          rowKey={(t) => t.id}
          matches={matches}
          value={view}
          grid="2.2fr 1.3fr 0.8fr 1.2fr 1fr 0.4fr"
          minWidth={720}
          className="w-full"
          ariaLabel="Open support tickets"
          empty="No tickets in this view."
        />
        </div>
      </Widget>

      <Widget title="At-risk ARR and renewals" meta={`${formatKpi("usd", arrAtRisk)} ARR`}>
        <ul className="flex flex-col divide-y divide-hairline">
          {accounts.map(({ c, v1 }) => (
            <li key={c.id} className="flex items-center gap-3 py-2 text-xs">
              <span className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="flex items-center gap-1.5 truncate text-sm font-medium text-strong">
                  {c.name}
                  {v1 && <StatusPill tone="gap" label="v1" />}
                </span>
                <span className="flex items-center gap-2" role="img" aria-label={`Health ${c.healthScore} of 100`}>
                  <span className="h-1.5 w-24 overflow-hidden rounded-full bg-raised">
                    <span
                      className={`block h-full rounded-full ${c.healthScore < 50 ? "bg-conflict" : c.healthScore < 70 ? "bg-gap" : "bg-covered"}`}
                      style={{ width: `${c.healthScore}%` }}
                    />
                  </span>
                  <span className="tabular-nums text-faint">{c.healthScore}</span>
                </span>
              </span>
              <span className="flex shrink-0 flex-col items-end gap-0.5 tabular-nums">
                <span className="text-body">{formatKpi("usd", c.arr)}</span>
                <span className="text-faint">renews {fmtDay(c.renewalDate)}</span>
              </span>
            </li>
          ))}
        </ul>
      </Widget>

      <Widget title="CSAT trend" meta="last 14 days">
        <div className="flex items-end justify-between gap-3">
          <span className="text-3xl font-semibold tabular-nums text-strong">{csat[csat.length - 1]}%</span>
          <span className="text-xs text-faint">low {Math.min(...csat)}% · high {Math.max(...csat)}%</span>
        </div>
        <Sparkline points={csat} tone={csat[csat.length - 1] < 85 ? "gap" : "covered"} width={420} height={96} className="h-24 w-full" />
        <p className="text-xs text-faint">Derived from how many of the week&apos;s tickets met their first-response SLA.</p>
      </Widget>
    </TeamFrame>
  );
}
