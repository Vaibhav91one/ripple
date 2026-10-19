"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState, type ComponentProps } from "react";
import { PageHeader } from "@/components/shell/PageHeader";
import { TEAMS } from "@/components/shell/nav";
import { GraphDownBanner, LoadingBlock } from "@/components/states/States";
import { ExplainBox } from "@/components/ui/explain-box";
import { card } from "@/components/ui/hatch";
import { NeedsYou } from "@/components/ui/needs-you";
import { SummaryLine } from "@/components/ui/summary-line";
import { Pill } from "@/components/ui/tone";
import { ackBrief, getHome, getNames, isGraphDown } from "@/lib/api";
import { proposalTitle } from "@/lib/approvals/title";
import { describeEdge } from "@/lib/changes";
import type { HomeBrief } from "@/lib/schemas";
import { fmtDate } from "@/lib/date";

type Row = ComponentProps<typeof NeedsYou>["rows"][number];

const DAY = 86_400_000;
const date = fmtDate;
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const STATUS = { conflict: "Conflict", gap: "Not acknowledged", covered: "Acknowledged" } as const;

const btn = "rounded-control border border-hairline px-2.5 py-1 text-2xs font-medium text-body transition-colors hover:bg-raised hover:text-strong focus-visible:outline-2 focus-visible:outline-ripple disabled:opacity-50";

/** The four brief actions, the same as the email and Slack buttons: ack, concern, not relevant (signed tokens) and open. */
function BriefActions({ b, lens }: { b: HomeBrief; lens: string }) {
  const qc = useQueryClient();
  const ack = useMutation({
    mutationFn: (kind: "seen" | "concern" | "not_relevant") => ackBrief(b.tokens![kind], kind),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["home", lens] }),
  });
  const off = !b.tokens || ack.isPending;
  const hint = b.tokens ? undefined : "Demo is read-only. Sign in to acknowledge.";
  return (
    <>
      <button type="button" className={btn} disabled={off} title={hint} onClick={() => ack.mutate("seen")}>Acknowledge</button>
      <button type="button" className={btn} disabled={off} title={hint} onClick={() => ack.mutate("concern")}>Raise a concern</button>
      <button type="button" className={btn} disabled={off} title={hint} onClick={() => ack.mutate("not_relevant")}>Not relevant</button>
      <Link href={`/reports/${encodeURIComponent(b.decisionId)}`} className={btn}>Open</Link>
      {hint && <span className="self-center text-2xs text-faint">{hint}</span>}
      {ack.isError && <span role="alert" className="self-center text-2xs text-faint">{ack.error.message}</span>}
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-sm font-medium text-faint">{title}</h2>
      {children}
    </section>
  );
}

export function HomeScreen({ lens }: { lens: string }) {
  const { data: h, isPending, error, refetch } = useQuery({ queryKey: ["home", lens], queryFn: getHome });
  const names = useQuery({ queryKey: ["names"], queryFn: getNames, staleTime: Infinity });
  const [now] = useState(() => Date.now());
  const team = TEAMS.find((t) => t.id === h?.teamId)?.label ?? "your team";
  const name = (id: string) => names.data?.[id] ?? id;
  const waited = (iso: string) => `Waiting since ${date(Date.parse(iso) / 1000)}`;

  const summary = h && [
    h.angle?.changes.length ? `${plural(h.angle.changes.length, "change")} hit ${team}` : "",
    h.conflicts ? plural(h.conflicts, "conflict") : "",
    h.briefs.length ? `${plural(h.briefs.length, "brief")} waiting` : "",
  ].filter(Boolean).join(", ");

  const rows: Row[] = h ? [
    ...h.briefs.map((b) => ({
      icon: h.hits.find((x) => x.decisionId === b.decisionId)?.status === "conflict" ? ("warning" as const) : ("pin" as const),
      title: b.title, sub: `Brief to acknowledge · ${date(b.at)}`,
      href: `/reports/${encodeURIComponent(b.decisionId)}`, actions: <BriefActions b={b} lens={lens} />,
    })),
    ...h.approvals.map((a) => ({ icon: "pin" as const, title: a.subject ? proposalTitle({ summary: "", subject: a.subject }, name) : `Approve: ${a.kind.replaceAll("_", " ")}`, sub: waited(a.requestedAt), href: "/reports" })),
    ...h.accessRequests.map((a) => ({ icon: "pin" as const, title: "Access request", sub: waited(a.requestedAt), href: "/reports" })),
    ...h.inbox.forMe.flatMap((i): Row[] => i.kind === "review"
      ? [{ icon: "pin", title: i.title, sub: `Review assigned to you · ${date(i.at)}`, href: `/items/task/${encodeURIComponent(i.taskId)}` }] : []),
    ...h.tasks.map((t) => ({
      icon: "pin" as const, title: t.title,
      sub: `${t.mine ? "Your task" : `${team} task`}${t.dueAt ? ` · due ${date(t.dueAt)}${t.dueAt * 1000 < now ? ", overdue" : ""}` : ""}`,
      href: `/items/task/${encodeURIComponent(t.id)}`,
    })),
    ...h.inbox.forMe.flatMap((i): Row[] => i.kind === "waiting"
      ? [{ icon: "refresh", title: i.title, sub: `${plural(Math.max(1, Math.floor((now - i.at * 1000) / DAY)), "day")} waiting`, href: `/teams/${encodeURIComponent(i.waitingOn)}` }] : []),
  ] : [];

  return (
    <div className="mx-auto flex w-full max-w-[960px] flex-col gap-8 px-4 py-8 sm:px-8">
      {isGraphDown(error) && <GraphDownBanner onRetry={() => void refetch()} />}
      <PageHeader title="Home" subtitle={h ? `What needs you and ${team} today` : undefined} />
      {isPending && <LoadingBlock label="Loading your day" />}
      {h && (
        <>
          <SummaryLine
            date={new Date(now).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}
            summary={summary ? `Since you last looked: ${summary}.` : "Nothing new since you last looked."}
            onRefresh={() => void refetch()}
          />
          <NeedsYou title="Needs you" sub={rows.length ? plural(rows.length, "item") : "All clear"} rows={rows} empty="Nothing needs you today." />

          {h.inbox.sent.length > 0 && (
            <Section title="Briefs you sent">
              <ul className={`${card} divide-y divide-hairline px-5`}>
                {h.inbox.sent.map((s) => (
                  <li key={s.id} className="flex items-center justify-between gap-4 py-3">
                    <Link href={`/reports/${encodeURIComponent(s.decisionId)}`} className="min-w-0 truncate text-sm text-strong hover:underline">{s.title}</Link>
                    <Pill tone={s.status === "acked" ? "covered" : "gap"} dot>{s.status === "acked" ? "Acknowledged" : "Waiting"}</Pill>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          <Section title={`What hits ${team}`}>
            {h.hits.length ? (
              <div className="flex flex-col gap-3">
                {h.hits.map((x) => (
                  <article key={x.decisionId} className={`${card} flex flex-col gap-3 p-5`}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <Link href={`/reports/${encodeURIComponent(x.decisionId)}`} className="text-md font-medium text-strong hover:underline">{x.title}</Link>
                      <span className="flex items-center gap-2">
                        {x.conflicts > 0 && <span className="text-2xs text-faint">{plural(x.conflicts, "open conflict")}</span>}
                        <Pill tone={x.status} dot>{STATUS[x.status]}</Pill>
                      </span>
                    </div>
                    {x.contractIds.length > 0 && (
                      <p className="text-sm text-body">
                        {x.contractIds.every((c) => names.data?.[c]) ? x.contractIds.map(name).join(" and ") : plural(x.contractIds.length, "contract")} promise
                        {x.contractIds.length === 1 ? "s" : ""} availability past the sunset date.
                      </p>
                    )}
                    {x.why.length > 0 && <ExplainBox title={`Why this reaches ${team}`} body={x.why.slice(0, 2).map((w) => w.text).join(" ")} />}
                  </article>
                ))}
              </div>
            ) : (
              <p className="text-sm text-faint">Nothing open hits {team}.</p>
            )}
          </Section>

          <Section title={`Recent activity for ${team}`}>
            {h.angle?.changes.length ? (
              <ul className={`${card} divide-y divide-hairline px-5`}>
                {h.angle.changes.slice(0, 6).map((c, i) => (
                  <li key={i} className="flex items-baseline justify-between gap-4 py-2.5 text-sm text-body">
                    <span className="min-w-0">{describeEdge(c.edge, name)}</span>
                    <span className="shrink-0 text-2xs text-faint">{date(c.at)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-faint">No recent activity.</p>
            )}
          </Section>

          {h.notifications.notifications.length > 0 && (
            <Section title={`Notified you${h.notifications.unread ? ` · ${h.notifications.unread} unread` : ""}`}>
              <ul className={`${card} divide-y divide-hairline px-5`}>
                {h.notifications.notifications.slice(0, 5).map((n) => (
                  <li key={n.id} className="py-3">
                    <Link href={`/items/${encodeURIComponent(n.subject.kind)}/${encodeURIComponent(n.subject.id)}`} className="text-sm text-strong hover:underline">{n.title}</Link>
                    <p className="mt-0.5 text-2xs text-faint">{n.reason}</p>
                  </li>
                ))}
              </ul>
            </Section>
          )}
        </>
      )}
    </div>
  );
}
