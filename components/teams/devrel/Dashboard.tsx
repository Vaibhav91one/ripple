"use client";

import { TaskList } from "@/components/kit/rareui/task-list";
import { StatusBars } from "@/components/kit/obsidian/analytics/status-bars";
import { StatusPill } from "@/components/kit/obsidian/analytics/status-pill";
import { TeamFrame, TeamState, Widget } from "../TeamFrame";
import { fmtDay } from "../format";
import { useNames, useTeamDashboard } from "../useTeamDashboard";

const th = "px-2 py-1.5 text-left text-2xs font-medium uppercase tracking-wide text-faint";
const td = "px-2 py-2 align-middle";

// DevRel workspace: Mintlify-style docs analytics, SDK adoption and the changelog queue.
export function DevrelDashboard() {
  const q = useTeamDashboard("devrel");
  const name = useNames();
  if (!q.data) return <TeamState error={q.error} onRetry={() => q.refetch()} />;
  const d = q.data;
  const pages = [...d.pages].sort((a, b) => b.views30d - a.views30d);
  const maxViews = pages[0]?.views30d ?? 1;
  const failed = [...d.docsStats.failedSearches].sort((a, b) => b.count - a.count);
  const maxFailed = failed[0]?.count ?? 1;
  const sdkName = (id: string) => d.sdks.find((s) => s.id === id)?.name ?? id;
  const tasks = [...d.tasks].sort((a, b) => (a.dueAt ?? 0) - (b.dueAt ?? 0));

  return (
    <TeamFrame title="DevRel" subtitle="Docs traffic, search gaps, SDK adoption and the changelog" kpis={d.kpis} angle={d.angle} restricted={d.restricted} teamName="DevRel">
      <Widget title="Top pages" wide meta="last 30 days">
        <div className="relative overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr><th className={th}>Page</th><th className={th}>Views</th><th className={th}>Helpful</th><th className={th} /></tr></thead>
            <tbody className="divide-y divide-hairline">
              {pages.map((p) => {
                const total = p.feedbackUp + p.feedbackDown;
                const up = total ? Math.round((100 * p.feedbackUp) / total) : 0;
                return (
                  <tr key={p.id}>
                    <td className={`${td} font-mono text-xs text-strong`}>{p.path}</td>
                    <td className={td}>
                      <span className="flex items-center gap-2">
                        <span className="h-1.5 w-24 overflow-hidden rounded-full bg-raised"><span className="block h-full rounded-full bg-ripple" style={{ width: `${(100 * p.views30d) / maxViews}%` }} /></span>
                        <span className="tabular-nums text-body">{p.views30d.toLocaleString("en-US")}</span>
                      </span>
                    </td>
                    <td className={td}>
                      <span className="flex items-center gap-2" role="img" aria-label={`${p.feedbackUp} up, ${p.feedbackDown} down`}>
                        <span className="flex h-1.5 w-28 overflow-hidden rounded-full bg-conflict-soft"><span className="block h-full bg-covered" style={{ width: `${up}%` }} /></span>
                        <span className="tabular-nums text-body">{up}%</span>
                        <span className="text-xs tabular-nums text-faint">👍 {p.feedbackUp} · 👎 {p.feedbackDown}</span>
                      </span>
                    </td>
                    <td className={td}>{p.v1Related && <StatusPill tone="gap" label="v1 sunset" />}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {pages.some((p) => p.path === "/v1/quickstart") && (
          <p className="text-xs text-faint">/v1/quickstart is the most visited page and is rated worst: it still points new users at the API being sunset.</p>
        )}
      </Widget>

      <Widget title="Failed searches" meta={`${failed.reduce((s, f) => s + f.count, 0)} total`}>
        <ul className="flex flex-col divide-y divide-hairline">
          {failed.map((f) => (
            <li key={f.query} className="flex items-center gap-3 py-2 text-sm">
              <span className="min-w-0 flex-1 truncate text-strong">{f.query}</span>
              <span className="h-1.5 w-20 overflow-hidden rounded-full bg-raised"><span className="block h-full rounded-full bg-gap" style={{ width: `${(100 * f.count) / maxFailed}%` }} /></span>
              <span className="w-8 text-right tabular-nums text-body">{f.count}</span>
            </li>
          ))}
        </ul>
      </Widget>

      <Widget title="SDK version adoption" meta="share of installs">
        <StatusBars
          rows={d.docsStats.sdkAdoption.map((s, i, all) => ({
            label: `${sdkName(s.sdk)} ${s.version}`,
            percent: s.share,
            tone: i === all.findLastIndex((x) => x.sdk === s.sdk) ? "conflict" : i === all.findIndex((x) => x.sdk === s.sdk) ? "covered" : "gap",
          }))}
        />
      </Widget>

      <Widget title="Changelog and deprecations" wide meta={`${tasks.filter((t) => t.status !== "done").length} open`}>
        <TaskList
          size="sm"
          className="w-full"
          defaultTasks={[
            { id: "v1-deprecation", label: "Write the v1 deprecation notice: shutdown Jan 31, 2027, link the migration guide" },
            ...tasks.map((t) => ({ id: t.id, label: `${t.title} · ${name(t.assigneeId)}${t.dueAt ? ` · due ${fmtDay(t.dueAt)}` : ""}`, done: t.status === "done" })),
          ]}
        />
      </Widget>
    </TeamFrame>
  );
}
