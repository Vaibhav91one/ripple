"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink, Network } from "lucide-react";
import { GraphDownBanner, LoadingBlock, NotFoundBlock } from "@/components/states/States";
import { SourceChip } from "@/components/ripple/TeamCard";
import { useNames } from "@/components/teams/useTeamDashboard";
import { ExplainBox } from "@/components/ui/explain-box";
import { StatusStrip, type StatusCell } from "@/components/ui/status-strip";
import type { Tone } from "@/components/ui/tone";
import { getItem, isGraphDown, NotFoundError } from "@/lib/api";
import { describeEdge } from "@/lib/changes";
import { ITEM_KINDS } from "@/lib/items/kinds";
import { restrictedLine } from "@/lib/permissions/classify";
import type { ItemView } from "@/lib/schemas";

const RESTRICTED = "Restricted";
const KIND_OF_LABEL = new Map(Object.values(ITEM_KINDS).map((a) => [a.graphLabel.toLowerCase(), a.kind]));
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const date = (ts: number) => new Date(ts * 1000).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const usd = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
/** Status colours keep one meaning each: bad news is conflict, finished is covered, waiting is gap, the rest is the accent. */
const tone = (s: string): Tone =>
  /deprecated|blocked|superseded|high|critical|failed|overdue|inactive/i.test(s) ? "conflict"
  : /done|merged|accepted|active|signed|approved|closed|resolved|passed/i.test(s) ? "covered"
  : /open|pending|draft|review|medium|in.?progress/i.test(s) ? "gap" : "ripple";

const focus = "focus-visible:outline-2 focus-visible:outline-ripple transition-colors";
const linkCls = `text-ripple-ink hover:underline ${focus}`;

/** Link to a neighbour's own page; labels without a page stay plain text. */
function ItemLink({ label, id, children }: { label: string; id: string; children: React.ReactNode }) {
  const kind = KIND_OF_LABEL.get(label.toLowerCase());
  if (!kind) return <>{children}</>;
  return <Link href={`/items/${kind}/${encodeURIComponent(id)}`} className={`text-strong hover:text-ripple-ink hover:underline ${focus}`}>{children}</Link>;
}

function Section({ title, count, children }: { title: string; count?: number; children: React.ReactNode }) {
  return (
    <section className="space-y-2.5">
      <h2 className="flex items-baseline gap-2 text-3xs font-medium uppercase tracking-[0.06em] text-faint">
        {title}
        {count !== undefined && <span className="font-mono normal-case tracking-normal">{count}</span>}
      </h2>
      {children}
    </section>
  );
}

const box = "divide-y divide-hairline rounded-[var(--ref-radius)] border border-hairline bg-surface";

/** First `n` rows, the rest behind a button: a system touches 100+ nodes. */
function Capped<T>({ rows, n, noun, children }: { rows: T[]; n: number; noun: string; children: (r: T) => React.ReactNode }) {
  const [all, setAll] = useState(false);
  return (
    <div className="space-y-2">
      <ul className={box}>{(all ? rows : rows.slice(0, n)).map(children)}</ul>
      {rows.length > n && (
        <button type="button" onClick={() => setAll(!all)} className={`text-xs text-faint hover:text-strong ${focus}`}>
          {all ? "Show fewer" : `Show all ${rows.length} ${noun}`}
        </button>
      )}
    </div>
  );
}

export function ItemPage({ kind, id }: { kind: string; id: string }) {
  const q = useQuery({
    queryKey: ["item", kind, id],
    queryFn: () => getItem(kind, id),
    retry: (n, e) => !(e instanceof NotFoundError) && !isGraphDown(e) && n < 2,
  });
  if (q.error instanceof NotFoundError) return <NotFoundBlock title="Item not found">There is no {kind} with the id &ldquo;{id}&rdquo; in the graph.</NotFoundBlock>;
  if (isGraphDown(q.error)) return <div className="p-6"><GraphDownBanner onRetry={() => q.refetch()} /></div>;
  if (q.error) return <p className="p-6 text-sm text-conflict-ink">Could not load this item.</p>;
  if (!q.data) return <div className="p-6"><LoadingBlock label="Loading the item" /></div>;
  return <Item v={q.data} />;
}

function Item({ v }: { v: ItemView }) {
  const name = useNames();
  // people and teams carry roles as node titles; the names map has the display name
  const titleOf = (id: string, t: string) => (t === RESTRICTED || name(id) === id ? t : name(id));
  const title = v.title === RESTRICTED ? `${cap(v.label)} (restricted)` : titleOf(v.id, v.title);
  const names = (i: string) => (i === v.id ? title : titleOf(i, v.edges.find((e) => e.other.id === i)?.other.title ?? i));

  const hidden = (typeof v.restricted === "string" ? [] : v.restricted ?? []).filter((r) => r.kind !== "source");
  const visible = v.neighbours.filter((n) => n.title !== RESTRICTED);
  const live = v.edges.filter((e) => e.other.title !== RESTRICTED);
  const spec = ITEM_KINDS[v.kind];
  const extra = spec?.extra ? v.edges.filter((e) => e.type === spec.extra!.edgeType && e.dir === "out" && e.other.title !== RESTRICTED) : [];
  const waiting = v.edges.find((e) => e.validTo === null && e.dir === "out" && (e.type === "WAITING_ON" || e.type === "BLOCKED_BY"));
  const cells: StatusCell[] = [
    { label: "Owner", value: v.owner ? name(v.owner) : "None" },
    { label: "Next action", value: waiting ? `${waiting.type === "BLOCKED_BY" ? "Blocked by" : "Waiting on"} ${names(waiting.other.id)}` : "Nothing pending" },
    { label: "Last change", value: v.edges[0] ? date(v.edges[0].validFrom) : "None" },
  ];
  const groups = Object.entries(Object.groupBy(visible.filter((n) => !extra.some((e) => e.other.id === n.id)), (n) => cap(n.label)));

  return (
    <div className="mx-auto grid w-full max-w-[1100px] gap-8 p-4 sm:p-6 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="min-w-0 space-y-8">
        {/* the promoted components set a 520px minimum; let them shrink on a phone */}
        <div className="space-y-3 [&_aside]:min-w-0 [&_aside]:max-w-none [&_section]:min-w-0 [&_section]:max-w-none">
          <StatusStrip
            crumb={["Items", cap(v.label)]}
            title={title}
            status={{ label: v.status ? cap(v.status) : cap(v.label), tone: v.status ? tone(v.status) : "ripple" }}
            meta={`${cap(v.label)} · ${v.id}`}
            cells={cells}
          />
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-sm">
            {v.sourceUrl && (
              <a href={v.sourceUrl} target="_blank" rel="noreferrer" className={`inline-flex items-center gap-1.5 ${linkCls}`}>
                Open in source <ExternalLink className="size-3.5" aria-hidden />
              </a>
            )}
            <Link href={`/graph?node=${encodeURIComponent(v.id)}`} className={`inline-flex items-center gap-1.5 text-faint hover:text-strong hover:underline ${focus}`}>
              View in graph <Network className="size-3.5" aria-hidden />
            </Link>
          </div>
        </div>

        {v.why.length > 0 && (
          <Section title="Why this matters" count={v.why.length}>
            <div className="space-y-4 [&_aside]:min-w-0 [&_aside]:max-w-none">
              {v.why.map((w) => (
                <div key={w.changeId} className="space-y-2">
                  <ExplainBox title={w.changeTitle} body={w.path.map((p) => p.name ?? p.id).join(" → ")} />
                  <div className="flex flex-wrap items-center gap-2 pl-1">
                    {w.rels.filter((r) => r.src && r.quote && r.quote !== "[restricted]").map((r) => <SourceChip key={r.src! + r.quote} artifactId={r.src!} quote={r.quote!} />)}
                    <Link href={`/items/${w.changeId.startsWith("d-") ? "decision" : "change"}/${w.changeId}`} className={`text-xs ${linkCls}`}>Open change</Link>
                  </div>
                </div>
              ))}
            </div>
          </Section>
        )}

        {v.findings.length > 0 && (
          <Section title="What Ripple concluded" count={v.findings.length}>
            <ul className={box}>
              {v.findings.map((f) => (
                <li key={f.id} className="space-y-1.5 px-4 py-3">
                  <p className="text-sm text-body">{f.text.replace(/\s*\[\[[^\]]+\]\]/g, "")}</p>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-faint">
                    <time className="font-mono">{date(f.at)}</time>
                    {f.agent && <span>{f.agent}</span>}
                    {f.confidence !== null && <span className="font-mono">{Math.round(f.confidence * 100)}% sure</span>}
                    {f.sources.map((s) => <SourceChip key={s} artifactId={s} quote="" />)}
                  </div>
                </li>
              ))}
            </ul>
          </Section>
        )}

        {spec?.extra && (
          <Section title={spec.extra.title} count={extra.length}>
            {extra.length === 0 ? (
              <p className="text-sm text-faint">Not visible from your team.</p>
            ) : (
              <ul className={box}>
                {extra.map((e) => (
                  <li key={e.other.id} className="space-y-1.5 px-4 py-3">
                    <p className="text-sm"><ItemLink label={e.other.label} id={e.other.id}>{e.other.title}</ItemLink></p>
                    {e.quote && <p className="text-sm text-body">&ldquo;{e.quote}&rdquo;</p>}
                    {e.src && e.quote && <SourceChip artifactId={e.src} quote={e.quote} />}
                  </li>
                ))}
              </ul>
            )}
          </Section>
        )}

        <Section title="Timeline" count={live.length}>
          {live.length === 0 ? <p className="text-sm text-faint">No dated changes yet.</p> : (
            <Capped rows={live} n={8} noun="events">
              {(e) => {
                const [from, to] = e.dir === "out" ? [v.id, e.other.id] : [e.other.id, v.id];
                return (
                  <li key={`${e.type}${e.dir}${e.other.id}${e.validFrom}`} className="flex flex-col gap-0.5 px-4 py-2.5 text-sm sm:flex-row sm:items-baseline sm:gap-4">
                    <time className="shrink-0 font-mono text-xs text-faint sm:w-24">{date(e.validFrom)}</time>
                    <span className="min-w-0 flex-1 text-body">
                      {describeEdge({ from, to, type: e.type as never, validFrom: e.validFrom }, names)}
                      {e.validTo !== null && <span className="text-faint"> · ended {date(e.validTo)}</span>}
                    </span>
                  </li>
                );
              }}
            </Capped>
          )}
        </Section>
      </div>

      <aside className="min-w-0 space-y-8" aria-label="Context">
        <Section title="Connected items" count={visible.length}>
          {groups.length === 0 ? <p className="text-sm text-faint">Nothing connected that you can see.</p> : (
            <div className="space-y-4">
              {groups.map(([label, ns = []]) => (
                <div key={label} className="space-y-1.5">
                  <h3 className="text-xs text-faint">{label}</h3>
                  <Capped rows={ns} n={5} noun="items">
                    {(n) => (
                      <li key={n.id + n.type} className="flex items-baseline justify-between gap-3 px-3 py-2 text-sm">
                        <span className="min-w-0 truncate"><ItemLink label={n.label} id={n.id}>{titleOf(n.id, n.title)}</ItemLink></span>
                        <span className="flex shrink-0 items-center gap-2">
                          <span className="font-mono text-2xs text-faint">{n.type.toLowerCase().replaceAll("_", " ")}</span>
                          <Link href={`/graph?node=${encodeURIComponent(n.id)}`} aria-label={`View ${n.title} in graph`} className={`text-faint hover:text-ripple-ink ${focus}`}>
                            <Network className="size-3.5" aria-hidden />
                          </Link>
                        </span>
                      </li>
                    )}
                  </Capped>
                </div>
              ))}
            </div>
          )}
        </Section>

        {v.whoKnows.length > 0 && (
          <Section title="Who knows" count={v.whoKnows.length}>
            <Capped rows={v.whoKnows} n={5} noun="people">
              {(w) => (
                <li key={w.personId} className="flex items-baseline justify-between gap-3 px-3 py-2 text-sm">
                  <Link href={`/items/person/${w.personId}`} className={`text-strong hover:text-ripple-ink hover:underline ${focus}`}>{name(w.personId)}</Link>
                  <span className="font-mono text-2xs text-faint">
                    {[w.authored && `${w.authored} authored`, w.reviewed && `${w.reviewed} reviewed`, w.handled && `${w.handled} handled`].filter(Boolean).join(" · ")}
                  </span>
                </li>
              )}
            </Capped>
          </Section>
        )}

        {hidden.length > 0 && (
          <Section title="Restricted">
            <ul className="space-y-1 rounded-[var(--ref-radius)] border border-hairline bg-surface px-4 py-3 text-sm text-faint">
              {hidden.map((r) => (
                <li key={r.owner + r.kind}>{restrictedLine(r)}{r.total ? ` (${usd(r.total)} total)` : ""}</li>
              ))}
            </ul>
          </Section>
        )}
      </aside>
    </div>
  );
}
