"use client";

import { useState } from "react";
import ApprovalCard, { type ApprovalAnswer, type ApprovalQuestion } from "@/components/kit/beautifului/approval-card";
import { Avatar } from "@/components/kit/obsidian/analytics/avatar";
import { StatusPill } from "@/components/kit/obsidian/analytics/status-pill";
import { useSourcePanel } from "@/components/panels/SourcePanel";
import type { Deal } from "@/lib/schemas";
import { teamName } from "@/lib/permissions/classify";
import { TeamFrame, TeamState, Widget } from "../TeamFrame";
import { fmtDay, formatKpi } from "../format";
import { useNames, useTeamDashboard } from "../useTeamDashboard";

const STAGES = [
  { id: "prospecting", label: "Prospecting" },
  { id: "qualified", label: "Qualified" },
  { id: "proposal", label: "Proposal" },
  { id: "negotiation", label: "Negotiation" },
] as const;
const usd = (n: number) => formatKpi("usd", n);

// Sales workspace: a HubSpot-style pipeline board, a Salesforce-style forecast and a deal desk.
export function SalesDashboard() {
  const q = useTeamDashboard("sales");
  const name = useNames();
  const panel = useSourcePanel();
  const [decision, setDecision] = useState<string | null>(null);
  if (!q.data) return <TeamState error={q.error} onRetry={() => q.refetch()} />;
  const d = q.data;
  const f = d.forecast;
  const open = d.deals.filter((x) => x.stage !== "closed_won" && x.stage !== "closed_lost");
  const v1Deals = open.filter((x) => x.v1Related);
  const quoteOf = (dealId: string) => d.promises.find((p) => p.dealId === dealId)?.source;
  // Deal desk: the biggest negotiation that is still outside the standard discount band.
  const desk: Deal | undefined = [...open].filter((x) => x.stage === "negotiation").sort((a, b) => b.amount - a.amount)[0];
  const questions: ApprovalQuestion[] = [
    { q: `Approve an 18% discount on ${desk ? name(desk.customerId) : "this deal"}?`, type: "radio", options: ["Approve 18%", "Counter at 12%", "Reject"] },
    { q: "Contract terms for the renewal", type: "radio", options: ["Standard terms", "Add a v1 sunset clause", "Send to Legal"] },
  ];
  const summary = (a: ApprovalAnswer[]) => a.map((x, i) => x.custom || questions[i].options[x.selected[0]]).join(" · ");

  const forecastRows: [string, number][] = [
    ["Quarter goal", f.goal], ["Closed won", f.closed], ["Gap to goal", f.gap],
    ["Commit (negotiation)", f.commit], ["Best case (all open)", f.bestCase], ["Weighted", f.weighted],
  ];

  return (
    <TeamFrame title="Sales" subtitle="Pipeline, forecast and deal desk" kpis={d.kpis} angle={d.angle} restricted={d.restricted} teamName="Sales">
      <Widget title="Pipeline" wide meta={`${open.length} open deals · ${usd(f.bestCase)}`}>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {STAGES.map((s) => {
            const deals = open.filter((x) => x.stage === s.id);
            const weighted = deals.reduce((t, x) => t + (x.amount * x.probability) / 100, 0);
            return (
              <section key={s.id} className="flex min-w-0 flex-col gap-2 rounded-md bg-page p-2" aria-label={s.label}>
                <header className="flex items-baseline justify-between px-1 text-xs">
                  <h3 className="font-medium text-strong">{s.label} <span className="text-faint">{deals.length}</span></h3>
                  <span className="tabular-nums text-faint" title="Weighted total">{usd(Math.round(weighted))}</span>
                </header>
                {deals.length === 0 && <p className="px-1 py-3 text-xs text-faint">No deals.</p>}
                {deals.map((x) => (
                  <article key={x.id} className="flex flex-col gap-1.5 rounded-md border border-hairline bg-surface p-2.5 text-xs">
                    <h4 className="truncate text-sm font-medium text-strong">{x.name}</h4>
                    <p className="truncate text-faint">{name(x.customerId)}</p>
                    <div className="flex items-center justify-between gap-2">
                      <span className="tabular-nums text-strong">{usd(x.amount)}</span>
                      <span className="flex items-center gap-1.5 text-faint">
                        {x.v1Related && <StatusPill tone="gap" label="v1" />}
                        <span className="tabular-nums">{x.probability}%</span>
                        <Avatar name={name(x.ownerId)} size={22} />
                      </span>
                    </div>
                  </article>
                ))}
              </section>
            );
          })}
        </div>
      </Widget>

      <Widget title="Forecast" meta="this quarter">
        <table className="w-full text-sm">
          <tbody className="divide-y divide-hairline">
            {forecastRows.map(([label, v]) => (
              <tr key={label}>
                <th scope="row" className="py-2 text-left font-normal text-body">{label}</th>
                <td className={`py-2 text-right tabular-nums ${label === "Gap to goal" && v > 0 ? "text-gap" : "text-strong"}`}>{usd(v)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Widget>

      <Widget title="Deal desk" meta="1 request">
        <div className="flex flex-col items-start gap-2">
          {desk && <p className="text-xs text-faint">{name(desk.ownerId)} asks for approval on {desk.name}, {usd(desk.amount)}.</p>}
          <ApprovalCard
            questions={questions}
            sentLabel="Decision recorded"
            onSubmit={(a) => setDecision(summary(a))}
            onReset={() => setDecision(null)}
          />
          {decision && <p className="text-xs text-covered">Recorded: {decision}</p>}
        </div>
      </Widget>

      <Widget title="Deals at risk from v1" wide meta={`${v1Deals.length} open deals promised API v1`}>
        <ul className="grid grid-cols-1 gap-3 lg:grid-cols-3">
          {v1Deals.map((x) => {
            const src = quoteOf(x.id);
            return (
              <li key={x.id} className="flex flex-col gap-2 rounded-md border border-hairline bg-page p-3 text-xs">
                <div className="flex items-start justify-between gap-2">
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate text-sm font-medium text-strong">{x.name}</span>
                    <span className="text-faint">{name(x.ownerId)} · closes {fmtDay(x.closeDate)}</span>
                  </span>
                  <span className="tabular-nums text-strong">{usd(x.amount)}</span>
                </div>
                {src?.restricted && <p className="text-faint">Promise restricted to {teamName(src.restricted)}</p>}
                {src && !src.restricted && (
                  <button
                    type="button"
                    onClick={() => panel.open(src.artifactId, src.quote)}
                    className="rounded-md border border-hairline bg-surface px-2 py-1.5 text-left text-body hover:border-ripple transition-colors"
                    title={`Open ${name(src.artifactId)}`}
                  >
                    <span className="block text-faint">Promise, {name(src.artifactId)}</span>
                    “{src.quote}”
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      </Widget>
    </TeamFrame>
  );
}
