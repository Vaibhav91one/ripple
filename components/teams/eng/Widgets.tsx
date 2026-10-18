"use client";

import { useState } from "react";
import { GitPullRequest, Server } from "lucide-react";
import { ActivityChart } from "@/components/kit/obsidian/analytics/activity-chart";
import { Avatar } from "@/components/kit/obsidian/analytics/avatar";
import { RepoCard } from "@/components/kit/obsidian/analytics/repo-card";
import { Segmented } from "@/components/kit/obsidian/analytics/segmented";
import { StatusPill } from "@/components/kit/obsidian/analytics/status-pill";
import type { Tone } from "@/components/kit/obsidian/analytics/tone";
import type { Incident, PrRow } from "@/lib/schemas";
import type { EngPayload } from "@/lib/teams/eng/schema";
import { Widget } from "../TeamFrame";
import { useNames } from "../useTeamDashboard";

type D = { d: EngPayload };
const HOUR = 3600;
const DAY = 86400;
const WEEK = 7 * DAY;

/** 480 → "8m", 7200 → "2h", 200000 → "2.3d". */
const dur = (sec: number) => (sec < HOUR ? `${Math.max(1, Math.round(sec / 60))}m` : sec < DAY ? `${Math.round(sec / HOUR)}h` : `${(sec / DAY).toFixed(1)}d`);
const hrs = (h: number) => (h < 1 ? `${Math.round(h * 60)}m` : `${h.toFixed(1)}h`);
const num = (v: number) => v.toLocaleString("en-US");

// ---------- review-requested PRs ----------
type Filter = "all" | "needs" | "unreviewed";
const FILTERS = [
  { id: "all", label: "All" },
  { id: "needs", label: "Needs review" },
  { id: "unreviewed", label: "Merged without review" },
] as const;

const needsReview = (p: PrRow) => p.state === "open" && p.firstReviewAt === null;
const mergedUnreviewed = (p: PrRow) => p.state === "merged" && p.firstReviewAt === null;

export function ReviewTable({ d }: D) {
  const name = useNames();
  const [filter, setFilter] = useState<Filter>("all");
  const rows = d.prs
    .filter((p) => (filter === "needs" ? needsReview(p) : filter === "unreviewed" ? mergedUnreviewed(p) : p.state === "open" || mergedUnreviewed(p)))
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 12);
  return (
    <Widget
      wide
      title="Pull requests awaiting review"
      meta={<Segmented label="Filter pull requests" options={FILTERS} value={filter} onChange={setFilter} />}
    >
      <div className="relative overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead>
            <tr className="border-b border-hairline text-xs uppercase tracking-wide text-faint">
              <th className="py-2 pr-3 font-medium">Pull request</th>
              <th className="px-3 py-2 font-medium">Author</th>
              <th className="px-3 py-2 font-medium">Reviewers</th>
              <th className="px-3 py-2 text-right font-medium">Size</th>
              <th className="py-2 pl-3 text-right font-medium">Age</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.id} className="border-b border-hairline last:border-0">
                <td className="max-w-[320px] py-2.5 pr-3">
                  <div className="flex items-center gap-2">
                    <GitPullRequest className={`size-4 shrink-0 ${p.state === "merged" ? "text-gap" : "text-covered"}`} aria-hidden />
                    <span className="truncate text-strong" title={p.title}>{p.title}</span>
                    {p.v1Related && <StatusPill tone="ripple" label="v1" />}
                  </div>
                  <div className="mt-0.5 pl-6 font-mono text-xs text-faint">
                    {name(p.repo)}
                    {mergedUnreviewed(p) && <span className="ml-2 text-conflict">merged without review</span>}
                  </div>
                </td>
                <td className="px-3 py-2.5">
                  <span className="flex items-center gap-2 text-body">
                    <Avatar name={name(p.authorId)} size={22} />
                    {name(p.authorId)}
                  </span>
                </td>
                <td className="px-3 py-2.5">
                  {p.reviewerIds.length ? (
                    <span className="flex -space-x-1.5" title={p.reviewerIds.map(name).join(", ")}>
                      {p.reviewerIds.map((r) => <Avatar key={r} name={name(r)} size={22} tone="neutral" />)}
                    </span>
                  ) : (
                    <span className="text-xs text-faint">none</span>
                  )}
                </td>
                <td className="whitespace-nowrap px-3 py-2.5 text-right font-mono text-xs">
                  <span className="text-covered">+{num(p.additions)}</span> <span className="text-conflict">-{num(p.deletions)}</span>
                </td>
                <td className="whitespace-nowrap py-2.5 pl-3 text-right text-xs text-faint">{dur(d.now - p.createdAt)}</td>
              </tr>
            ))}
            {!rows.length && (
              <tr><td colSpan={5} className="py-6 text-center text-sm text-faint">Nothing here.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </Widget>
  );
}

// ---------- cycle time ----------
const CYCLE_LEGEND = [
  { key: "coding", label: "Coding", tone: "neutral" },
  { key: "pickup", label: "Pickup", tone: "gap" },
  { key: "review", label: "Review", tone: "ripple" },
  { key: "deploy", label: "Deploy", tone: "covered" },
] as const;

export function CycleBreakdown({ d }: D) {
  const bars = d.cycle.map((w) => ({
    label: w.label,
    segments: CYCLE_LEGEND.map((l) => ({ key: l.key, value: w[l.key] })),
  }));
  const last = d.cycle.at(-1);
  return (
    <Widget title="Cycle time breakdown" meta={last ? `${last.merged} merged this week` : undefined}>
      <ActivityChart bars={bars} legend={[...CYCLE_LEGEND]} unit="hours" />
      <p className="text-xs text-faint">Average hours per merged PR, by week. Coding and deploy are estimates until PRs carry commit and deploy times.</p>
    </Widget>
  );
}

// ---------- PR quality ----------
export function PrQuality({ d }: D) {
  const { buckets, mergedWithoutReview, merged } = d.quality;
  const peak = Math.max(1, ...buckets.map((b) => b.count));
  return (
    <Widget title="PR quality" meta={`${d.prs.length} PRs`}>
      <ul className="flex flex-col gap-2.5" aria-label="PR size buckets">
        {buckets.map((b) => (
          <li key={b.id} className="grid grid-cols-[110px_1fr_28px] items-center gap-3 text-xs">
            <span className="text-body">{b.label}</span>
            <span className="h-2 overflow-hidden rounded-full bg-raised">
              <span className={`block h-full rounded-full ${b.id === "xl" ? "bg-gap" : "bg-ripple"}`} style={{ width: `${(b.count / peak) * 100}%` }} />
            </span>
            <span className="text-right font-mono text-strong">{b.count}</span>
          </li>
        ))}
      </ul>
      <div className="flex items-center justify-between rounded-md border border-hairline bg-raised px-3 py-2 text-sm">
        <span className="text-body">Merged without review</span>
        <span className="flex items-center gap-2">
          <span className="font-mono text-strong">{mergedWithoutReview} of {merged}</span>
          <StatusPill tone={mergedWithoutReview ? "conflict" : "covered"} label={mergedWithoutReview ? "Needs a look" : "Clean"} />
        </span>
      </div>
    </Widget>
  );
}

// ---------- services & on-call ----------
export function Services({ d }: D) {
  const name = useNames();
  return (
    <Widget wide title="Services and on-call" meta={`${d.services.length} services`}>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {d.services.map((s) => {
          const open = d.incidents.filter((i) => i.systemId === s.id && i.resolvedAt === null);
          const worst = open.some((i) => i.severity === "critical" || i.severity === "high");
          const status: { tone: Tone; label: string } =
            s.status === "sunset" || s.status === "deprecated"
              ? { tone: "gap", label: s.status === "sunset" ? "Sunsetting" : "Deprecated" }
              : open.length
                ? { tone: worst ? "conflict" : "gap", label: `${open.length} open incident${open.length > 1 ? "s" : ""}` }
                : { tone: "covered", label: "Healthy" };
          const openPrs = d.prs.filter((p) => p.repo === s.id && p.state === "open").length;
          // PRs opened per week, oldest first
          const activity = Array.from({ length: 6 }, (_, i) => d.prs.filter((p) => p.repo === s.id && Math.floor((d.now - p.createdAt) / WEEK) === 5 - i).length);
          return (
            <RepoCard
              key={s.id}
              icon={<Server className="size-4 text-faint" aria-hidden />}
              title={s.name}
              tag={s.version ?? undefined}
              status={status}
              meta={s.onCallPersonId ? `On call: ${name(s.onCallPersonId)}` : "No one on call"}
              activity={activity}
              stats={[{ label: `${openPrs} open PR${openPrs === 1 ? "" : "s"}` }, ...(s.successor ? [{ label: `replaced by ${name(s.successor)}` }] : [])]}
            />
          );
        })}
      </div>
    </Widget>
  );
}

// ---------- incident feed ----------
const SEV: Record<Incident["severity"], Tone> = { critical: "conflict", high: "conflict", medium: "gap", low: "neutral" };

export function IncidentFeed({ d }: D) {
  const name = useNames();
  const incs = [...d.incidents].sort((a, b) => b.startedAt - a.startedAt);
  return (
    <Widget wide title="Incident feed" meta={`MTTA ${hrs(d.incidentStats.mttaH)} · MTTR ${hrs(d.incidentStats.mttrH)}`}>
      <ul className="flex flex-col divide-y divide-hairline">
        {incs.map((i) => (
          <li key={i.id} className="grid grid-cols-[88px_1fr_auto] items-center gap-3 py-2.5 text-sm">
            <StatusPill tone={SEV[i.severity]} label={i.severity} />
            <div className="min-w-0">
              <p className="truncate text-strong" title={i.title}>{i.title}</p>
              <p className="font-mono text-xs text-faint">{name(i.systemId)} · {dur(d.now - i.startedAt)} ago</p>
            </div>
            <div className="flex items-center gap-2 text-xs text-faint">
              <span>{i.acknowledgedAt === null ? "unacknowledged" : `ack ${dur(i.acknowledgedAt - i.startedAt)}`}</span>
              <StatusPill tone={i.resolvedAt === null ? "gap" : "covered"} label={i.resolvedAt === null ? "Open" : `Resolved ${dur(i.resolvedAt - i.startedAt)}`} />
            </div>
          </li>
        ))}
      </ul>
    </Widget>
  );
}
