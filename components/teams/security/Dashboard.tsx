"use client";

import { useState } from "react";
import ApprovalCard from "@/components/kit/beautifului/approval-card";
import { SlideConfirm } from "@/components/kit/bencho/slide-confirm";
import { TaskList } from "@/components/kit/rareui/task-list";
import { Segmented } from "@/components/kit/obsidian/analytics/segmented";
import { StatusBars } from "@/components/kit/obsidian/analytics/status-bars";
import { StatusPill } from "@/components/kit/obsidian/analytics/status-pill";
import type { Tone } from "@/components/kit/obsidian/analytics/tone";
import type { Finding, Vendor } from "@/lib/schemas";
import { frameworkReadiness } from "@/lib/teams/security/schema";
import { fmtDay } from "../format";
import { TeamFrame, TeamState, Widget } from "../TeamFrame";
import { useNames, useTeamDashboard } from "../useTeamDashboard";

const DAY = 86400;
const SEVERITIES = ["critical", "high", "medium", "low"] as const;
const SEV_TONE: Record<Finding["severity"], Tone> = { critical: "conflict", high: "gap", medium: "neutral", low: "neutral" };
const TIER_RANK: Record<Vendor["riskTier"], number> = { high: 3, medium: 2, low: 1 };
const TIER_TONE: Record<Vendor["riskTier"], Tone> = { high: "conflict", medium: "gap", low: "neutral" };
const ASSESS: Record<Vendor["assessmentStatus"], { label: string; tone: Tone }> = {
  current: { label: "Assessed", tone: "covered" },
  due: { label: "Review due", tone: "gap" },
  overdue: { label: "Overdue", tone: "conflict" },
};
const th = "px-2 py-1.5 text-left text-[11px] font-medium uppercase tracking-wide text-faint";
const td = "px-2 py-2 align-middle";

const days = (n: number) => `${Math.max(1, Math.round(Math.abs(n) / DAY))}d`;
const score = (r: { likelihood: number; impact: number }) => r.likelihood * r.impact;

// Security workspace: the frame, KPIs and Ripple angle are shared; these are the team's own widgets.
export function SecurityDashboard() {
  const q = useTeamDashboard("security");
  const name = useNames();
  const [sev, setSev] = useState<"all" | Finding["severity"]>("all");
  const [reviewed, setReviewed] = useState<string[]>([]); // local only: no API write
  const [verdict, setVerdict] = useState<string | null>(null);
  if (!q.data) return <TeamState error={q.error} onRetry={() => q.refetch()} />;
  const d = q.data;

  const readiness = frameworkReadiness(d);
  const failing = d.controls.filter((c) => c.status === "failing").sort((a, b) => Number(b.auditBlocking) - Number(a.auditBlocking));
  const open = d.findings.filter((f) => f.status !== "resolved");
  const count = (s: Finding["severity"]) => open.filter((f) => f.severity === s).length;
  const findings = d.findings
    .filter((f) => sev === "all" || f.severity === sev)
    .sort((a, b) => Number(a.status === "resolved") - Number(b.status === "resolved") || SEVERITIES.indexOf(a.severity) - SEVERITIES.indexOf(b.severity) || a.slaDueAt - b.slaDueAt);
  const status = (v: Vendor) => (reviewed.includes(v.id) ? "current" : v.assessmentStatus);
  const vendors = [...d.vendors].sort((a, b) => TIER_RANK[b.riskTier] - TIER_RANK[a.riskTier] || a.nextReview - b.nextReview);
  const pending = vendors.find((v) => v.assessmentStatus !== "current"); // the one review waiting on a human
  const risks = [...d.risks].sort((a, b) => score(b) - score(a));
  const fwName = (id: string) => d.frameworks.find((f) => f.id === id)?.name ?? id;

  return (
    <TeamFrame title="Security" subtitle="Controls, frameworks, findings and vendor risk" kpis={d.kpis} angle={d.angle} teamName="Security">
      <Widget title="Framework readiness" meta="Controls passing">
        <StatusBars rows={readiness.map((f) => ({ label: f.name, percent: f.percent, tone: f.percent >= 90 ? "covered" : f.percent >= 70 ? "gap" : "conflict" }))} />
      </Widget>

      <Widget title="Failing controls" meta={`${failing.length} failing`}>
        <ul className="flex flex-col divide-y divide-hairline">
          {failing.map((c) => (
            <li key={c.id} className="flex items-center justify-between gap-3 py-2">
              <div className="min-w-0">
                <p className="truncate text-sm text-strong">{c.name}</p>
                <p className="text-xs text-faint">{fwName(c.frameworkId)} · {name(c.ownerId)}{c.v1Related && " · v1 sunset"}</p>
              </div>
              {c.auditBlocking ? <StatusPill tone="conflict" label="Audit blocker" /> : <StatusPill label="Failing" />}
            </li>
          ))}
        </ul>
      </Widget>

      <Widget title="Findings by severity" meta={`${open.length} open`} wide>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            {SEVERITIES.map((s) => <StatusPill key={s} tone={SEV_TONE[s]} label={`${count(s)} ${s}`} />)}
          </div>
          <Segmented label="Filter by severity" value={sev} onChange={setSev} options={[{ id: "all", label: "All" }, ...SEVERITIES.map((s) => ({ id: s, label: s[0].toUpperCase() + s.slice(1) }))]} />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr><th className={th}>Finding</th><th className={th}>System</th><th className={th}>Severity</th><th className={th}>SLA</th><th className={th}>Owner</th></tr></thead>
            <tbody className="divide-y divide-hairline">
              {findings.map((f) => {
                const done = f.status === "resolved";
                const breached = !done && f.slaDueAt < d.now;
                return (
                  <tr key={f.id} className={done ? "opacity-60" : undefined}>
                    <td className={td}>
                      <span className="text-strong">{f.title}</span>
                      {f.v1Related && <StatusPill className="ml-2" tone="ripple" label="v1 sunset" />}
                    </td>
                    <td className={`${td} text-body`}>{name(f.systemId)}</td>
                    <td className={td}><StatusPill tone={SEV_TONE[f.severity]} label={f.severity} /></td>
                    <td className={td}>
                      {done ? <StatusPill tone="covered" label="Resolved" />
                        : breached ? <StatusPill tone="conflict" label={`Breached ${days(d.now - f.slaDueAt)} ago`} />
                        : <span className="text-body">Due {fmtDay(f.slaDueAt)} · {days(f.slaDueAt - d.now)}</span>}
                    </td>
                    <td className={`${td} text-body`}>{name(f.ownerId)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {findings.some((f) => f.v1Related) && (
          <p className="text-xs text-faint">Findings tagged v1 sunset (such as the v1 API keys on {name("api-v1")}) clear when the v1 sunset ships.</p>
        )}
      </Widget>

      <Widget title="Vendor risk assessments" meta={`${vendors.filter((v) => status(v) !== "current").length} need review`} wide>
        <div className="grid grid-cols-1 items-start gap-6 md:grid-cols-[minmax(0,1fr)_auto]">
          <table className="w-full text-sm">
            <thead><tr><th className={th}>Vendor</th><th className={th}>Risk tier</th><th className={th}>Assessment</th><th className={th}>Next review</th></tr></thead>
            <tbody className="divide-y divide-hairline">
              {vendors.map((v) => (
                <tr key={v.id}>
                  <td className={`${td} text-strong`}>{v.name}</td>
                  <td className={td}><StatusPill tone={TIER_TONE[v.riskTier]} label={v.riskTier} /></td>
                  <td className={td}><StatusPill tone={ASSESS[status(v)].tone} label={ASSESS[status(v)].label} /></td>
                  <td className={`${td} text-body`}>{fmtDay(v.nextReview)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {pending && (
            <div className="flex flex-col gap-3">
              <p className="text-xs text-faint">Pending review: {pending.name}, due {fmtDay(pending.nextReview)}</p>
              <ApprovalCard
                key={pending.id}
                questions={[{ q: `Outcome of the ${pending.name} assessment?`, type: "radio", options: ["Approve for 12 months", "Approve with conditions", "Request more evidence"] }]}
                sentLabel="Decision recorded"
                onSubmit={([a]) => setVerdict(a.selected.length ? ["Approve for 12 months", "Approve with conditions", "Request more evidence"][a.selected[0]] : a.custom)}
              />
              <SlideConfirm
                label={`Slide to confirm ${pending.name}`}
                doneLabel="Review confirmed"
                onConfirm={() => setReviewed((r) => [...r, pending.id])}
              />
              {verdict && <p className="text-xs text-faint">Decision: {verdict} (not saved)</p>}
            </div>
          )}
        </div>
      </Widget>

      <Widget title="Questionnaires and access reviews" meta={`${d.tasks.filter((t) => t.status !== "done").length} open`}>
        <TaskList
          size="sm"
          className="w-full"
          defaultTasks={[...d.tasks].sort((a, b) => (a.dueAt ?? 0) - (b.dueAt ?? 0)).map((t) => ({
            id: t.id,
            label: `${t.title} · ${name(t.assigneeId)}${t.dueAt ? ` · due ${fmtDay(t.dueAt)}` : ""}`,
            done: t.status === "done",
          }))}
        />
      </Widget>

      <Widget title="Risk register" meta="Likelihood × impact">
        <ul className="flex flex-col divide-y divide-hairline">
          {risks.map((r) => (
            <li key={r.id} className="flex items-center gap-3 py-2">
              <StatusPill className="shrink-0" tone={score(r) >= 15 ? "conflict" : score(r) >= 9 ? "gap" : "neutral"} label={`${r.likelihood}×${r.impact} = ${score(r)}`} />
              <div className="min-w-0">
                <p className="truncate text-sm text-strong">{r.title}</p>
                <p className="text-xs text-faint">{name(r.ownerId)} · {r.status}{r.v1Related && " · v1 sunset"}</p>
              </div>
            </li>
          ))}
        </ul>
      </Widget>
    </TeamFrame>
  );
}
