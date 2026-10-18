"use client";

import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { parseAsStringLiteral, useQueryState } from "nuqs";
import { useEffect, useId, useRef, useState } from "react";
import { ArrowRight, Bot, ChevronRight, CircleCheck, ExternalLink, FileText, Lock, Megaphone, Share2, ShieldAlert, Sparkles, UserX, X } from "lucide-react";
import { GraphEmbed } from "@/components/graph/GraphEmbed";
import { PageHeader } from "@/components/shell/PageHeader";
import { GraphDownBanner, NotFoundBlock } from "@/components/states/States";
import { ActionToast } from "@/components/ui/action-toast";
import { Card, CardHeader } from "@/components/ui/card";
import { EvidenceDiff } from "@/components/ui/evidence-diff";
import { hatch } from "@/components/ui/hatch";
import { HatchedBar } from "@/components/ui/hatched-bar";
import { HeroNumber } from "@/components/ui/hero-number";
import { NeedsYou } from "@/components/ui/needs-you";
import { PageSkeleton } from "@/components/ui/skeleton";
import { StatusPill } from "@/components/ui/status-pill";
import { TargetBar } from "@/components/ui/target-bar";
import { chaseTeam, decideApproval, getApprovals, getReport, isGraphDown, NotFoundError } from "@/lib/api";
import { day, dayTime, daysLeft, eventTone, gaps, isReadOnlyError, runChase, safeUrl, type ChaseResult, KIND_LABEL, noticedSentence, STATE, TEAM_STATUS, teamDelta, teamsWorstFirst, usd, type Gap } from "@/lib/reports-ui";
import type { ReportDetail, TimelineEvent } from "@/lib/schemas/reports";
import { DemoTag, KIND_ICON, Segmented, TabPanel } from "./shared";

const TABS = ["overview", "timeline", "artifacts", "runs"] as const;
const pill = "inline-flex h-10 items-center gap-2 rounded-control px-3.5 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ripple disabled:cursor-not-allowed disabled:opacity-50";
const primary = `${pill} bg-strong text-ink-on-strong shadow-[0_1px_2px_oklch(0_0_0/0.15)] hover:bg-body`;
const DOT = { conflict: "bg-conflict", gap: "bg-gap", ink: "bg-strong" } as const;

type Toast = { title: string; body: string };
const TOAST: Record<ChaseResult, (team: string) => Toast> = {
  sent: (t) => ({ title: `Reminder to ${t} approved`, body: `It is queued to send to the ${t} owner. Coverage moves when they acknowledge.` }),
  already: (t) => ({ title: "Already sent", body: `A reminder to ${t} for this change was already approved. Nothing new was sent.` }),
  proposed: (t) => ({ title: `Reminder to ${t} proposed`, body: "It waits in Approvals for an admin or lead to approve it." }),
};

/** `readOnly` = the shared demo: actions render disabled with a hint. `canDecide` = the viewer may approve send_reminder (admin or lead). */
export function CaseFile({ id, readOnly: ro, canDecide }: { id: string; readOnly: boolean; canDecide: boolean }) {
  const qc = useQueryClient();
  const [tab, setTab] = useQueryState("tab", parseAsStringLiteral(TABS).withDefault("overview"));
  const [refused, setRefused] = useState(false); // a 403 demo_readonly from the server
  const readOnly = ro || refused;
  const [open, setOpen] = useState<Gap | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const { data, error, refetch } = useQuery({ queryKey: ["report", id], queryFn: () => getReport(id) });
  const approvals = useQuery({ queryKey: ["approvals", "open", id], queryFn: () => getApprovals("open", id) });

  const act = useMutation({
    mutationFn: async (g: Gap) => ({ g, res: await runChase(() => chaseTeam(id, g.teamId), async (a) => (await decideApproval(a, "approve")).results.some((x) => x.changed), canDecide) }),
    onSuccess: ({ g, res }) => {
      setOpen(null);
      setToast(TOAST[res](g.name));
      void qc.invalidateQueries({ queryKey: ["report", id] });
      void qc.invalidateQueries({ queryKey: ["approvals"] });
    },
    onError: (e) => { if (isReadOnlyError(e)) setRefused(true); },
  });

  if (error instanceof NotFoundError) return <NotFoundBlock title="No case file for this change" href="/reports" cta="All reports">Ripple has no change with the id {id}.</NotFoundBlock>;
  if (isGraphDown(error)) return <GraphDownBanner onRetry={() => void refetch()} />;
  if (!data) return <PageSkeleton />;

  const r = data.report;
  const st = STATE[r.state];
  const g = gaps(data);
  const sys = r.systems.map((s) => s.name).join(", ");
  const sub = [sys, data.announcedBy ? `announced ${day(r.announcedAt)} by ${data.announcedBy.name}` : `announced ${day(r.announcedAt)}`, r.effectiveAt ? `effective ${day(r.effectiveAt)}` : null, `${data.counts.teams} teams, ${data.counts.customers} customers`].filter(Boolean).join(" · ");
  const pending = (approvals.data?.approvals ?? []).filter((a) => a.status === "pending");

  return (
    <>
      <PageHeader
        crumbs={[{ label: "Reports", href: "/reports" }, { label: r.id.toUpperCase() }]}
        title={<span className="inline-flex flex-wrap items-center gap-x-4 gap-y-2 whitespace-normal">{r.title}<StatusPill tone={st.tone}>{st.label}</StatusPill></span>}
        subtitle={sub}
      >
        <ShareButton />
        {g[0] && <ActButton readOnly={readOnly} className={primary} onClick={() => setOpen(g[0])}><Megaphone size={15} aria-hidden />{g[0].action}</ActButton>}
      </PageHeader>

      <div className="mb-4 -mt-1 overflow-x-auto">
        <Segmented tabs="case" label="Case file sections" value={tab} onChange={(v) => void setTab(v)} options={[{ id: "overview", label: "Overview" }, { id: "timeline", label: `Timeline ${data.timeline.length}` }, { id: "artifacts", label: "Artifacts" }, { id: "runs", label: "Agent runs" }]} />
      </div>

      <TabPanel tabs="case" id={tab}>
      {tab === "overview" && <Overview d={data} gaps={g} pending={pending} readOnly={readOnly} onAct={setOpen} onTimeline={() => void setTab("timeline")} />}
      {tab === "timeline" && <Card><CardHeader title="Every event" sub={`${data.timeline.length} events, oldest first. Seeded history is marked demo.`} /><EventList events={data.timeline} /></Card>}
      {tab === "artifacts" && <Artifacts d={data} />}
      {tab === "runs" && <Runs events={data.timeline} />}
      </TabPanel>

      {open && <ApproveModal d={data} gap={open} readOnly={readOnly} canDecide={canDecide} busy={act.isPending} error={act.error && !isReadOnlyError(act.error) ? act.error.message : null} onClose={() => { setOpen(null); act.reset(); }} onConfirm={() => act.mutate(open)} />}
      {toast && (
        <div className="fixed inset-x-0 bottom-6 z-50 flex justify-center px-4">
          <ActionToast
            title={toast.title}
            body={toast.body}
            time="Just now"
            action="See case file"
            dismiss="Close"
            onAction={() => { setToast(null); void setTab("timeline"); window.scrollTo({ top: 0 }); }}
            onDismiss={() => setToast(null)}
          />
        </div>
      )}
    </>
  );
}

function ShareButton() {
  const [done, setDone] = useState(false);
  return (
    <button type="button" className={`${pill} text-strong hover:bg-raised`} onClick={() => void navigator.clipboard?.writeText(window.location.href).then(() => setDone(true))}>
      <Share2 size={15} aria-hidden />{done ? "Link copied" : "Share"}
    </button>
  );
}

/** Disabled with a "Read-only demo" hint in the shared demo; works in local mode and for signed-in orgs. */
function ActButton({ readOnly, className, onClick, children }: { readOnly: boolean; className: string; onClick: () => void; children: React.ReactNode }) {
  const hint = useId();
  if (!readOnly) return <button type="button" className={className} onClick={onClick}>{children}</button>;
  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button type="button" disabled aria-describedby={hint} className={className}>{children}</button>
      <span id={hint} className="inline-flex items-center gap-1 text-xs text-faint"><Lock size={11} aria-hidden />Read-only demo</span>
    </span>
  );
}

function Overview({ d, gaps: g, pending, readOnly, onAct, onTimeline }: { d: ReportDetail; gaps: Gap[]; pending: { id: string; summary: string; proposer: string }[]; readOnly: boolean; onAct: (g: Gap) => void; onTimeline: () => void }) {
  const r = d.report;
  const c = r.coverage;
  const conflict = d.conflicts.find((x) => x.status === "open");
  const noticed = noticedSentence(d);
  const legal = g.find((x) => x.teamId === "legal");
  const left = r.effectiveAt ? daysLeft(r.effectiveAt, d.now) : null;
  const events = [...d.timeline].sort((a, b) => a.at - b.at);
  const strip = events.slice(0, 5);
  const demo = d.timeline.filter((e) => e.demo).length;
  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0 space-y-4">
          <Card>
            <CardHeader
              title="Teams: expected vs done"
              sub="Who needed to act, and what they did"
              action={
                <div className="flex shrink-0 gap-4 text-xs text-faint">
                  <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-4 rounded-[3px]" style={hatch("var(--faint)")} />Expected</span>
                  <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-4 rounded-[3px] bg-strong" />Done</span>
                </div>
              }
            />
            <ul className="mt-5 divide-y divide-hairline">
              {teamsWorstFirst(d.teams).map((t) => {
                const s = TEAM_STATUS[t.status];
                return (
                  <li key={t.teamId} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 py-3 sm:grid-cols-[11rem_minmax(0,1fr)_9rem_6rem]">
                    <div className="min-w-0">
                      <p className="text-md font-medium text-strong">{t.name}</p>
                      <p className="truncate text-sm text-faint">{t.expected}</p>
                    </div>
                    <div className="order-last col-span-2 sm:order-none sm:col-span-1"><HatchedBar plan={100} actual={s.actual} max={100} label={`${t.name}: ${s.note(t)}`} /></div>
                    <p className="hidden text-sm text-body sm:block">{s.note(t)}</p>
                    <p className={`text-right text-sm font-medium ${t.status === "acked" ? "text-faint" : t.status === "told" ? "text-gap" : "text-conflict"}`}>{t.status === "not_told" ? "Not told" : teamDelta(t)}</p>
                  </li>
                );
              })}
            </ul>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-inset bg-raised/60 px-4 py-3.5 text-md">
              <span className="font-medium text-strong">Teams told {d.result.teamsTold} of {c.affected} · acked {d.result.teamsAcked} of {c.affected}</span>
              <span className={c.pct < 100 ? "font-medium text-conflict" : "text-faint"}>{c.pct}% coverage</span>
            </div>
          </Card>

          <Card>
            <CardHeader title="What happened" action={<button type="button" onClick={onTimeline} className="inline-flex items-center gap-1 text-sm text-faint hover:text-strong">View all {d.timeline.length} events<ChevronRight size={14} aria-hidden /></button>} />
            <div className={`mt-6 grid gap-6 ${noticed ? "xl:grid-cols-[minmax(0,1fr)_280px]" : ""}`}>
              <div className="-mx-1 overflow-x-auto px-1 pb-1">
                <ol className="grid min-w-[520px] grid-flow-col auto-cols-fr">
                  {strip.map((e, i) => (
                    <li key={`${e.id}-${i}`} className="relative pr-4">
                      {i < strip.length - 1 && <span aria-hidden className="absolute left-2 right-0 top-[5px] h-px bg-hairline" />}
                      <span aria-hidden className={`relative block size-[11px] rounded-full ring-4 ring-surface ${DOT[eventTone(e.kind)]}`} />
                      <p className="mt-3 flex items-center gap-1.5 whitespace-nowrap text-xs text-faint">{day(e.at)}{e.demo && <DemoTag />}</p>
                      <p className="mt-1 text-sm font-medium text-strong">{KIND_LABEL[e.kind]}</p>
                      <p className="mt-1 line-clamp-3 text-xs leading-snug text-faint">{e.text}</p>
                    </li>
                  ))}
                </ol>
              </div>
              {noticed && (
                <aside className="rounded-inset bg-gap-soft p-4">
                  <p className="flex items-center gap-1.5 text-xs font-medium text-gap"><Sparkles size={12} aria-hidden />Ripple noticed</p>
                  <p className="mt-2 text-sm leading-relaxed text-strong">{noticed}</p>
                  <a href="#evidence" className={`${pill} mt-3 h-9 bg-surface text-strong shadow-[0_1px_2px_oklch(0_0_0/0.08)] hover:bg-raised`}>See both quotes</a>
                </aside>
              )}
            </div>
            <p className="mt-4 text-xs text-faint">{d.timeline.length} events{demo ? `, ${demo} of them seeded demo history` : ""}.</p>
          </Card>
        </div>

        <div className="min-w-0 space-y-4">
          <Card>
            <CardHeader title="Result" sub={r.effectiveAt ? `Goal: every team told and acked before ${day(r.effectiveAt)}` : "Goal: every team told and acked"} />
            <div className="mt-5">
              <HeroNumber value={`${c.pct}%`} delta={{ value: `${100 - c.pct} pts`, dir: "down", tone: c.pct < 100 ? "bad" : "neutral", vs: "vs 100% needed" }}>
                {c.pct < 100 ? `${c.affected - c.told} of ${c.affected} teams have not been told.` : "Every affected team has been told."}{" "}
                {r.arrAtRisk ? `${usd(r.arrAtRisk)} of ARR rides on this change.` : ""}
              </HeroNumber>
            </div>
            <div className="mt-6"><TargetBar value={c.pct} target={100} from={`Now ${c.pct}%`} targetLabel="Needed 100%" tone={c.pct < 100 ? "conflict" : "ripple"} label="Coverage against the 100% goal" /></div>
            <dl className="mt-5 divide-y divide-hairline text-md">
              {[
                ["ARR at risk", usd(r.arrAtRisk), conflict ? `${d.counts.contracts} ${d.counts.contracts === 1 ? "contract guarantees" : "contracts guarantee"} it` : "No contract guarantee"],
                ["Customers", String(d.counts.customers), `${d.result.noticesSent} notified${d.result.noticesSentDemo ? " (demo)" : ""}`],
                ["Days left", left === null ? "No date" : String(Math.max(0, left)), r.effectiveAt ? `until ${day(r.effectiveAt)}` : ""],
              ].map(([k, v, s]) => (
                <div key={k} className="flex items-baseline justify-between gap-3 py-3">
                  <dt className="text-body">{k}</dt>
                  <dd className="flex items-baseline gap-3"><span className="font-medium tabular-nums text-strong">{v}</span><span className="text-sm text-faint">{s}</span></dd>
                </div>
              ))}
            </dl>
          </Card>
          <NeedsYou
            title="Pending on you"
            sub={pending.length ? `${pending.length} waiting for your OK` : "Nothing waiting"}
            empty="No approvals wait on you for this change."
            rows={pending.slice(0, 4).map((a) => ({ id: a.id, icon: CircleCheck, tone: "gap", title: a.summary, sub: `Proposed by ${a.proposer}`, href: `/approvals?a=${a.id}` }))}
          />
        </div>
      </div>

      <Card id="graph" className="scroll-mt-6 overflow-hidden !p-0">
        <div className="p-6 pb-4">
          <CardHeader
            title="The ripple in the graph"
            sub="Every team, system and customer this change reaches, as FalkorDB holds them. Hover a dot to light up what it touches."
            action={<Link href={`/graph?q=${encodeURIComponent(r.title)}`} className="inline-flex items-center gap-1 text-sm text-faint hover:text-strong">Open in the graph<ChevronRight size={14} aria-hidden /></Link>}
          />
        </div>
        <div className="border-t border-hairline"><GraphEmbed d={r.id} height={360} /></div>
      </Card>

      {conflict && (
        <Card id="evidence" className="scroll-mt-6">
          <CardHeader title="Ripple noticed a conflict" sub="Two sources disagree about the same system. Both quotes, side by side." />
          <div className="mt-5 overflow-x-auto">
            <EvidenceDiff
              title={conflict.contracts[0]?.name ?? "Contract guarantee"}
              found={`Found ${day(conflict.detectedAt)} · ${conflict.severity} severity`}
              action={legal ? legal.action : "Review"}
              onAction={legal && !readOnly ? () => onAct(legal) : undefined}
              docLine={conflict.sources[1]?.quote ?? "Restricted"}
              groups={conflict.sources.map((s, i) => ({
                label: i === 0 ? "The decision says" : `${conflict.contracts[i - 1]?.name ?? `Contract ${i}`} says`,
                chips: [{ text: s.quote ?? "Restricted to its owning team", tone: i === 0 ? "conflict" : "covered" }],
                caption: s.artifactId ?? "Source restricted",
              }))}
            />
          </div>
        </Card>
      )}

      {g.length > 0 && (
        <section aria-label="Gaps" className={`grid gap-4 sm:grid-cols-2 ${g.length === 3 ? "xl:grid-cols-3" : "xl:grid-cols-4"}`}>
          {g.map((x) => (
            <Card key={x.teamId} className="flex flex-col">
              <span className={`grid size-9 place-items-center rounded-full ${x.status === "told" ? "bg-gap-soft text-gap" : "bg-conflict-soft text-conflict"}`}>{x.arr ? <ShieldAlert size={16} aria-hidden /> : <UserX size={16} aria-hidden />}</span>
              <p className={`mt-4 text-3xl font-light tracking-[-0.04em] ${x.status === "told" ? "text-gap" : "text-conflict"}`}>{x.figure}</p>
              <p className="text-xs text-faint">{x.figureNote}</p>
              <h3 className="mt-3 text-md font-medium text-strong">{x.name} {x.status === "told" ? "has not acked" : "not told"}</h3>
              <p className="mt-1 mb-4 text-sm leading-relaxed text-faint">{x.body}</p>
              <div className="mt-auto">
                <ActButton readOnly={readOnly} className="inline-flex items-center gap-1 text-sm font-medium text-strong hover:underline disabled:cursor-not-allowed disabled:opacity-50" onClick={() => onAct(x)}>
                  {x.action}<ChevronRight size={14} aria-hidden />
                </ActButton>
              </div>
            </Card>
          ))}
        </section>
      )}
    </div>
  );
}

function EventList({ events }: { events: TimelineEvent[] }) {
  if (!events.length) return <p className="mt-6 text-sm text-faint">Nothing recorded yet.</p>;
  return (
    <ol className="mt-4 divide-y divide-hairline">
      {[...events].sort((a, b) => a.at - b.at).map((e, i) => {
        const Icon = KIND_ICON[e.kind];
        return (
          <li key={`${e.id}-${i}`} className="flex items-start gap-3 py-3">
            <span className={`grid size-9 shrink-0 place-items-center rounded-full ${e.kind === "conflict" ? "bg-conflict-soft text-conflict" : "bg-raised text-body"}`}><Icon size={16} aria-hidden /></span>
            <div className="min-w-0 flex-1">
              <p className="text-md text-strong">{e.text} {e.demo && <DemoTag />}</p>
              <p className="text-sm text-faint">{dayTime(e.at)} · {KIND_LABEL[e.kind]} by {e.actor.name}</p>
            </div>
            {safeUrl(e.url) && <a href={safeUrl(e.url)!} target="_blank" rel="noreferrer" className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-strong hover:underline">Open<ExternalLink size={13} aria-hidden /></a>}
          </li>
        );
      })}
    </ol>
  );
}

function Artifacts({ d }: { d: ReportDetail }) {
  type Row = { key: string; icon: typeof FileText; title: string; quote?: string | null; meta: string; url?: string | null; demo?: boolean };
  const rows: Row[] = [
    ...(d.sourceRef ? [{ key: "src", icon: FileText, title: "The announcement", quote: d.sourceRef.quote, meta: d.sourceRef.artifactId }] : []),
    ...d.conflicts.flatMap((c) => c.sources.slice(1).map((s, i) => ({ key: `${c.id}-${i}`, icon: ShieldAlert, title: c.contracts[i]?.name ?? "Contract clause", quote: s.quote ?? "Restricted to its owning team", meta: s.artifactId ?? "restricted" }))),
    ...d.timeline.filter((e) => e.kind === "issue" || e.kind === "notified" || e.kind === "proposed").map((e, i) => ({ key: `${e.id}-${i}`, icon: KIND_ICON[e.kind], title: e.text, meta: `${KIND_LABEL[e.kind]} · ${dayTime(e.at)}`, url: e.url, demo: e.demo })),
  ];
  return (
    <Card>
      <CardHeader title="Artifacts" sub="Sources, contract clauses, notices, drafts and GitHub issues for this change" />
      <ul className="mt-4 divide-y divide-hairline">
        {rows.map(({ key, icon: Icon, title, quote, meta, url, demo }) => (
          <li key={key} className="flex items-start gap-3 py-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-raised text-body"><Icon size={16} aria-hidden /></span>
            <div className="min-w-0 flex-1">
              <p className="text-md font-medium text-strong">{title} {demo && <DemoTag />}</p>
              {quote && <p className="mt-1 rounded-control border border-hairline bg-raised px-2 py-1 font-mono text-sm text-body">“{quote}”</p>}
              <p className="mt-1 text-sm text-faint">{meta}</p>
            </div>
            {safeUrl(url) && <a href={safeUrl(url)!} target="_blank" rel="noreferrer" className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-strong hover:underline">Open<ExternalLink size={13} aria-hidden /></a>}
          </li>
        ))}
      </ul>
    </Card>
  );
}

function Runs({ events }: { events: TimelineEvent[] }) {
  const runs = events.filter((e) => e.actor.type === "agent" || e.kind === "run");
  return (
    <Card>
      <CardHeader title="Agent runs" sub="The graph decided who is affected. The agents only wrote the messages, and every send waited for a person." action={<Link href="/agents" className="inline-flex items-center gap-1 text-sm text-faint hover:text-strong">All agents<ChevronRight size={14} aria-hidden /></Link>} />
      {runs.length ? <EventList events={runs} /> : <p className="mt-6 flex items-center gap-2 text-sm text-faint"><Bot size={15} aria-hidden />No agent has run on this change yet.</p>}
    </Card>
  );
}

/** Confirm before committing (margin's confirm modal): what the action really does, and the conditional effect. Native <dialog>. */
function ApproveModal({ d, gap, readOnly, canDecide, busy, error, onClose, onConfirm }: { d: ReportDetail; gap: Gap; readOnly: boolean; canDecide: boolean; busy: boolean; error: string | null; onClose: () => void; onConfirm: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { ref.current?.showModal(); }, []);
  const c = d.report.coverage;
  const ifAck = gap.status === "told" ? c.pct : gap.after;
  return (
    <dialog ref={ref} onClose={onClose} aria-labelledby="approve-title" className="m-auto w-[min(520px,calc(100vw-32px))] rounded-card border border-hairline bg-surface p-6 text-strong shadow-xl backdrop:bg-strong/30">
      <header className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-gap-soft text-gap"><Megaphone size={17} aria-hidden /></span>
        <div className="min-w-0 flex-1">
          <h2 id="approve-title" className="text-lg font-medium">{gap.action}</h2>
          <p className="text-sm text-faint">{d.report.title} · {gap.name}</p>
        </div>
        <button type="button" onClick={() => ref.current?.close()} aria-label="Close" className="grid size-9 place-items-center rounded-full border border-hairline hover:bg-raised"><X size={15} aria-hidden /></button>
      </header>
      <p className="mt-4 text-md leading-relaxed text-body">{gap.body}</p>
      <div className="mt-4 rounded-inset bg-raised/70 p-4">
        <p className="text-md font-medium text-strong">Sends a reminder to the {gap.name} owner. Coverage moves when they acknowledge.</p>
        <div className="mt-3 flex items-end gap-4 border-t border-hairline pt-3">
          <span><span className="block text-xs text-faint">Coverage now</span><span className="text-3xl font-light tabular-nums">{c.pct}%</span></span>
          <ArrowRight size={18} aria-hidden className="mb-2 text-faint" />
          <span><span className="block text-xs text-faint">If {gap.name} acknowledges</span><span className="text-3xl font-light tabular-nums text-faint">{ifAck}%</span></span>
        </div>
        <p className="mt-2 text-sm text-faint">If {gap.name} acknowledges, coverage would be {ifAck}%. Sending the reminder alone does not change it.</p>
      </div>
      {!canDecide && !readOnly && <p className="mt-4 text-sm text-faint">Approving reminders needs the admin or lead role, so this one will wait in Approvals.</p>}
      {error && <p role="alert" className="mt-3 text-sm text-conflict">{error}</p>}
      <footer className="mt-6 flex items-center justify-end gap-2">
        {readOnly && <span className="mr-auto inline-flex items-center gap-1 text-xs text-faint"><Lock size={11} aria-hidden />Read-only demo: run Ripple locally to send</span>}
        <button type="button" onClick={() => ref.current?.close()} className={`${pill} bg-raised text-strong hover:bg-hairline`}>Cancel</button>
        <button type="button" onClick={onConfirm} disabled={readOnly || busy} className={primary}>{busy ? "Sending" : canDecide ? "Approve and send" : "Send for approval"}</button>
      </footer>
    </dialog>
  );
}
