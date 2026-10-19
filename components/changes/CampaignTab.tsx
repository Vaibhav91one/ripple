"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { BellRing, ExternalLink } from "lucide-react";
import { SteppedBars } from "@/components/ui/stepped-bars";
import { TimelineDemo } from "@/components/ui/timeline-demo";
import { Pill } from "@/components/ui/tone";
import { chaseTeam } from "@/lib/api";
import { teamName } from "@/lib/permissions/classify";
import type { Campaign, CampaignTeam } from "@/lib/schemas";
import { fmtDate } from "@/lib/date";

const iso = (ts: number) => new Date(ts * 1000).toISOString().slice(0, 10);
const day = (ts: number | null) => (ts ? fmtDate(ts) : null);
const DAY = 86_400;

const STAGES = [
  { id: "told", label: "Told" },
  { id: "delivered", label: "Delivered" },
  { id: "clicked", label: "Clicked" },
  { id: "acked", label: "Acked" },
] as const;
/** Acked also counts when the graph says the team is covered (an ack from any route, e.g. an email link). */
const reached = (t: CampaignTeam, s: (typeof STAGES)[number]["id"]) => (s === "acked" ? t.acked !== null || t.covered : t[s] !== null);

function Stage({ label, at, done }: { label: string; at: number | null; done: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="text-2xs text-faint">{label}</dt>
      <dd className={`text-sm tabular-nums ${done ? "text-strong" : "text-faint"}`}>{done ? (day(at) ?? "Yes") : "Pending"}</dd>
    </div>
  );
}

function TeamCard({ t, changeId, name }: { t: CampaignTeam; changeId: string; name: (id: string) => string }) {
  const qc = useQueryClient();
  const [note, setNote] = useState<string | null>(null);
  const chase = useMutation({
    mutationFn: () => chaseTeam(changeId, t.teamId),
    onSuccess: () => { setNote("Reminder proposed. Approve it in the Approvals tab."); void qc.invalidateQueries({ queryKey: ["approvals"] }); },
    onError: (e) => setNote(e.message === "demo_readonly" ? "The shared demo is read-only." : `Could not propose a reminder: ${e.message.slice(0, 80)}`),
  });
  const openTasks = t.tasks.filter((k) => k.status !== "done").length;
  return (
    <li className="flex flex-col gap-3 rounded-xl bg-surface p-4 shadow-[var(--kit-shadow-card)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-md font-medium text-strong">{teamName(t.teamId)}</h3>
          <p className="truncate text-xs text-faint">
            Owner {t.ownerId ? <Link href={`/items/person/${encodeURIComponent(t.ownerId)}`} className="text-body hover:underline">{name(t.ownerId)}</Link> : "unassigned"}
            {t.dueAt ? ` · due ${day(t.dueAt)}` : ""}
          </p>
        </div>
        <Pill tone={t.covered ? "covered" : "gap"} dot>{t.covered ? "Covered" : "Not told"}</Pill>
      </div>
      <dl className="grid grid-cols-4 gap-2">
        {STAGES.map((s) => <Stage key={s.id} label={s.label} at={s.id === "acked" ? t.acked : t[s.id]} done={reached(t, s.id)} />)}
      </dl>
      <dl className="grid grid-cols-3 gap-2 border-t border-hairline pt-3 text-sm">
        <div>
          <dt className="text-2xs text-faint">Discussed</dt>
          <dd className="text-strong">
            {t.discussed.length ? (
              t.discussed[0].permalink
                ? <a href={t.discussed[0].permalink} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:underline">{t.discussed.length} in Slack<ExternalLink className="size-3" aria-hidden /></a>
                : `${t.discussed.length} in Slack`
            ) : <span className="text-faint">No</span>}
          </dd>
        </div>
        <div>
          <dt className="text-2xs text-faint">Tasks</dt>
          <dd className="text-strong">{t.tasks.length ? `${t.tasks.length - openTasks}/${t.tasks.length} done` : <span className="text-faint">None</span>}</dd>
        </div>
        <div>
          <dt className="text-2xs text-faint">Access</dt>
          <dd className="text-strong">{t.access.total ? `${t.access.pending} pending of ${t.access.total}` : <span className="text-faint">None</span>}</dd>
        </div>
      </dl>
      {t.tasks.length > 0 && (
        <ul className="space-y-1 text-xs text-body">
          {t.tasks.map((k) => (
            <li key={k.id} className="flex items-center gap-2">
              <span aria-hidden className={`size-1.5 shrink-0 rounded-full ${k.status === "done" ? "bg-covered" : "bg-gap"}`} />
              <Link href={`/items/task/${encodeURIComponent(k.id)}`} className="min-w-0 flex-1 truncate hover:underline">{k.title}</Link>
              {k.dueAt && <span className="shrink-0 text-faint">due {day(k.dueAt)}</span>}
            </li>
          ))}
        </ul>
      )}
      <div className="mt-auto flex items-center gap-3">
        {!t.covered && (
          <button type="button" onClick={() => chase.mutate()} disabled={chase.isPending}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-hairline px-3 text-sm text-strong transition-colors hover:bg-raised focus-visible:outline-2 focus-visible:outline-ripple disabled:opacity-50">
            <BellRing className="size-3.5" aria-hidden />{chase.isPending ? "Proposing…" : "Chase"}
          </button>
        )}
        {note && <p role="status" className="min-w-0 text-xs text-faint">{note}</p>}
      </div>
    </li>
  );
}

export function CampaignTab({ c, name }: { c: Campaign; name: (id: string) => string }) {
  const total = c.teams.length;
  const count = (s: (typeof STAGES)[number]["id"]) => c.teams.filter((t) => reached(t, s)).length;
  const acked = count("acked");
  const today = iso(Math.floor(Date.now() / 1000));

  // Timeline: one bar per team from the day it was told to its due date; untold teams show a marker at the due date.
  const dated = [...c.teams.flatMap((t) => [t.told, t.dueAt]), c.effectiveAt].filter((x): x is number => !!x);
  const from = Math.min(...dated, Date.parse(today) / 1000) - 3 * DAY;
  const to = Math.max(...dated, Date.parse(today) / 1000) + 7 * DAY;
  const days = Math.ceil((to - from) / DAY);
  const bar = (t: CampaignTeam) => {
    const due = t.dueAt ?? c.effectiveAt;
    const done = reached(t, "acked");
    const common = { id: t.teamId, title: teamName(t.teamId), tone: done ? "covered" as const : t.told ? "ripple" as const : "gap" as const, status: done ? "done" as const : t.told ? "half" as const : "todo" as const, who: teamName(t.teamId).slice(0, 2).toUpperCase() };
    if (!t.told || !due) return { ...common, ...(due ? { noBar: "not told", noBarAt: iso(due) } : {}) };
    return { ...common, start: iso(t.told), end: iso(Math.max(due, t.told + DAY)) };
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="relative overflow-x-auto"><div className="min-w-[600px]"><SteppedBars
        title="Campaign funnel" figure={`${acked}/${total}`} chip="teams acknowledged"
        text="How many affected teams reached each stage. Slack reports sent, never read, so there is no read step."
        kv={[{ label: "Effective", value: day(c.effectiveAt) ?? "Not set" }, { label: "Teams", value: String(total) }]}
        columns={STAGES.map((s) => ({ date: s.label, value: count(s.id), label: `${count(s.id)} of ${total}` }))}
        min={0} max={Math.max(total, 1)} tooltip={{ at: -1, text: ["", ""] }}
      /></div></div>
      <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {c.teams.map((t) => <TeamCard key={t.teamId} t={t} changeId={c.changeId} name={name} />)}
      </ul>
      <div className="relative overflow-x-auto">
        <TimelineDemo
          title="Due dates" subtitle="From the day each team was told to the day its task is due, up to the change date."
          searchPlaceholder="Search teams" sortLabel="Sort: Team" groupLabel="Group" groupOptions={["Change"]}
          todayLabel="Today" weeksLabel="Weeks" monthsLabel="Months" taskHeading="Team" milestonesLabel="Change date" emptyText="No affected teams"
          initialZoom="months" start={iso(from)} days={days} today={today} height={Math.min(480, 120 + total * 40)}
          groups={[{ id: c.changeId, name: c.title, count: total, tone: "ripple", tasks: c.teams.map(bar) }]}
          milestones={c.effectiveAt ? [{ id: "effective", date: iso(c.effectiveAt), label: "Change takes effect" }] : []}
          deps={[]}
        />
      </div>
    </div>
  );
}
