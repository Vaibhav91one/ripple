"use client";
// Timeline: task column, sticky date header, bars, dependency curves, today line, milestone lane.
// Rebuilt from a written spec (Gr8r has no licence; none of its code was read or copied).
import { useEffect, useRef, type CSSProperties } from "react";
import { m } from "motion/react";
import { ArrowUpDown, Check, ChevronDown, Crosshair, Diamond, ListFilter, Search } from "lucide-react";

export type Tone = "covered" | "gap" | "ripple" | "conflict" | "muted";
export type Zoom = "weeks" | "months";
export type TimelineTask = {
  id: string;
  title: string;
  tone: Tone;
  status: "done" | "half" | "todo";
  /** Subtask count, e.g. "1/3". */
  sub?: string;
  /** Avatar initials. */
  who: string;
  /** ISO dates; `end` is exclusive. Omit both for a task with no bar. */
  start?: string;
  end?: string;
  /** 0..1 */
  progress?: number;
  /** Label shown where a bar would be (e.g. "not told"), at `noBarAt`. */
  noBar?: string;
  noBarAt?: string;
};
export type TimelineGroup = { id: string; name: string; count: number; tone: Tone; tasks: TimelineTask[] };
export type TimelineMilestone = { id: string; date: string; label?: string };
export type TimelineDep = { from: string; to: string };
export type TimelineProps = {
  title: string;
  subtitle: string;
  searchPlaceholder: string;
  sortLabel: string;
  groupLabel: string;
  groupOptions: string[];
  todayLabel: string;
  weeksLabel: string;
  monthsLabel: string;
  taskHeading: string;
  milestonesLabel: string;
  emptyText: string;
  /** ISO first day, number of days, today. */
  start: string;
  days: number;
  today: string;
  groups: TimelineGroup[];
  milestones: TimelineMilestone[];
  /** Count shown in the lane when it differs from the milestones passed. */
  milestoneCount?: number;
  deps: TimelineDep[];
  zoom: Zoom;
  onZoom?: (z: Zoom) => void;
  query?: string;
  onQuery?: (q: string) => void;
  /** Bump to scroll today into view again. */
  todayTick?: number;
  onToday?: () => void;
  height?: number;
};

const TONE: Record<Tone, string> = {
  covered: "var(--covered)", gap: "var(--gap)", ripple: "var(--ripple)", conflict: "var(--conflict)", muted: "var(--faint)",
};
const ROW = 36, BAR = 24, HEAD = 52, LABEL_W = 300, INSIDE_MIN = 110;
const DAY_MS = 86_400_000;
const idx = (start: string, iso: string) => Math.round((Date.parse(iso) - Date.parse(start)) / DAY_MS);
const tone = (t: Tone) => ({ "--c": TONE[t] }) as CSSProperties;

function Avatar({ who, size = 18 }: { who: string; size?: number }) {
  return (
    <span className="grid shrink-0 place-items-center rounded-full border border-hairline bg-raised font-medium text-body" style={{ width: size, height: size, fontSize: size * 0.42 }}>
      {who}
    </span>
  );
}

function StatusIcon({ status, t }: { status: TimelineTask["status"]; t: Tone }) {
  const base = "size-[14px] shrink-0";
  if (status === "done")
    return <span style={tone(t)} className={`${base} grid place-items-center rounded-full bg-[var(--c)]`}><Check className="size-[10px] text-[var(--accent-ink)]" strokeWidth={3} /></span>;
  return (
    <svg viewBox="0 0 14 14" className={base} style={tone(t)} aria-hidden>
      <circle cx="7" cy="7" r="5.5" fill="none" stroke="var(--c)" strokeWidth="1.5" />
      {status === "half" && <path d="M7 3.5a3.5 3.5 0 0 1 0 7z" fill="var(--c)" />}
    </svg>
  );
}

export function Timeline(p: TimelineProps) {
  const dw = p.zoom === "weeks" ? 32 : 11;
  const W = p.days * dw;
  const scroller = useRef<HTMLDivElement>(null);
  const first = useRef(true);
  const todayIdx = idx(p.start, p.today);

  // Rows: milestone lane, then each group row followed by its tasks.
  const rows: ({ k: "ms" } | { k: "group"; g: TimelineGroup } | { k: "task"; t: TimelineTask })[] = [{ k: "ms" }];
  p.groups.forEach((g) => {
    rows.push({ k: "group", g });
    g.tasks.forEach((t) => rows.push({ k: "task", t }));
  });
  const taskCount = p.groups.reduce((n, g) => n + g.tasks.length, 0);
  const H = rows.length * ROW;

  // Scroll today into view (only when it is not already visible).
  useEffect(() => {
    const el = scroller.current;
    if (!el || todayIdx < 0 || todayIdx >= p.days) return;
    const x = todayIdx * dw, avail = el.clientWidth - LABEL_W;
    const visible = x >= el.scrollLeft && x <= el.scrollLeft + avail - 60;
    if (visible && first.current) { first.current = false; return; }
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches || first.current;
    el.scrollTo({ left: Math.max(0, x - avail / 2), behavior: calm ? "auto" : "smooth" });
    first.current = false;
  }, [p.zoom, p.todayTick, todayIdx, dw, p.days]);

  // Bar geometry, by task id, for dependency curves.
  const geo = new Map<string, { x1: number; x2: number; y: number }>();
  rows.forEach((r, i) => {
    if (r.k !== "task" || !r.t.start || !r.t.end) return;
    geo.set(r.t.id, { x1: idx(p.start, r.t.start) * dw, x2: idx(p.start, r.t.end) * dw, y: i * ROW + ROW / 2 });
  });

  // Milestones merge per date.
  const msByDate = new Map<string, TimelineMilestone[]>();
  p.milestones.forEach((x) => msByDate.set(x.date, [...(msByDate.get(x.date) ?? []), x]));

  const months: { label: string; from: number; n: number }[] = [];
  const dayCells = Array.from({ length: p.days }, (_, i) => {
    const d = new Date(Date.parse(p.start) + i * DAY_MS);
    const label = `${d.toLocaleString("en-US", { month: "long", timeZone: "UTC" })} ${d.getUTCFullYear()}`;
    const last = months[months.length - 1];
    if (last?.label === label) last.n++; else months.push({ label, from: i, n: 1 });
    return { i, num: d.getUTCDate(), weekend: [0, 6].includes(d.getUTCDay()) };
  });

  const btn = "inline-flex h-8 items-center gap-1.5 rounded-control px-2.5 text-xs text-body hover:bg-raised focus-visible:outline focus-visible:outline-2 focus-visible:outline-ripple";
  return (
    <section className="w-full min-w-[720px] text-body">
      <header className="space-y-1 pb-4">
        <h4 className="text-xl font-semibold leading-8 text-strong">{p.title}</h4>
        <p className="text-xs text-faint">{p.subtitle}</p>
        <div className="flex flex-wrap items-center gap-1 pt-3">
          <label className="flex h-8 w-[144px] items-center gap-2 rounded-control border border-hairline bg-surface px-2.5 text-faint focus-within:border-ripple">
            <Search className="size-3.5 shrink-0" aria-hidden />
            <input value={p.query ?? ""} onChange={(e) => p.onQuery?.(e.target.value)} placeholder={p.searchPlaceholder} aria-label={p.searchPlaceholder}
              className="min-w-0 flex-1 bg-transparent text-xs text-strong outline-none placeholder:text-faint" />
          </label>
          <button type="button" className={`${btn} ml-2`}><ListFilter className="size-3.5" aria-hidden />Filter</button>
          <button type="button" className={btn}><ArrowUpDown className="size-3.5" aria-hidden />{p.sortLabel}</button>
          <div role="group" className="flex h-8 items-center rounded-control bg-raised p-0.5">
            {(["weeks", "months"] as const).map((z) => (
              <button key={z} type="button" aria-pressed={p.zoom === z} onClick={() => p.onZoom?.(z)}
                className={`h-7 rounded-chip px-3 text-xs focus-visible:outline focus-visible:outline-2 focus-visible:outline-ripple ${p.zoom === z ? "bg-overlay text-strong" : "text-faint hover:text-body"}`}>
                {z === "weeks" ? p.weeksLabel : p.monthsLabel}
              </button>
            ))}
          </div>
          <label className="relative ml-1 inline-flex h-8 items-center rounded-control border border-hairline text-xs">
            <span className="pl-2.5 pr-1">{p.groupLabel}:</span>
            <select defaultValue={p.groupOptions[0]} className="h-full appearance-none bg-transparent pr-6 text-body outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-ripple" aria-label={p.groupLabel}>
              {p.groupOptions.map((o) => <option key={o} className="bg-overlay">{o}</option>)}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2 size-3" aria-hidden />
          </label>
          <button type="button" className={`${btn} ml-1`} onClick={p.onToday}><Crosshair className="size-3.5" aria-hidden />{p.todayLabel}</button>
        </div>
      </header>

      <div ref={scroller} className="relative overflow-auto border-t border-hairline bg-surface" style={{ height: p.height ?? 480 }}>
        <div style={{ width: LABEL_W + W }}>
          {/* sticky header */}
          <div className="sticky top-0 z-30 flex border-b border-hairline bg-surface" style={{ height: HEAD }}>
            <div className="sticky left-0 z-10 flex shrink-0 items-end border-r border-hairline bg-surface px-4 pb-2 text-xs text-faint" style={{ width: LABEL_W }}>{p.taskHeading}</div>
            <div className="relative" style={{ width: W }}>
              <div className="relative h-[26px]">
                {months.map((mo) => (
                  <div key={mo.label} className="absolute top-0 flex h-full items-center border-l border-hairline px-2.5 text-2xs font-semibold text-strong" style={{ left: mo.from * dw, width: mo.n * dw }}>
                    <span className="truncate">{mo.label}</span>
                  </div>
                ))}
              </div>
              <div className="relative h-[26px]">
                {dayCells.map((d) => {
                  const show = p.zoom === "weeks" || d.i % 7 === 0;
                  return (
                    <span key={d.i} className={`absolute top-0 flex h-full items-center justify-center text-2xs ${d.i === todayIdx ? "font-semibold text-ripple" : "text-faint"}`}
                      style={{ left: d.i * dw, width: p.zoom === "weeks" ? dw : 7 * dw, justifyContent: p.zoom === "weeks" ? "center" : "flex-start" }}>
                      {show && d.num}
                    </span>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="flex">
            {/* task column */}
            <div className="sticky left-0 z-20 shrink-0 border-r border-hairline bg-surface" style={{ width: LABEL_W }}>
              {rows.map((r, i) => {
                const cell = "flex items-center gap-2 border-b border-hairline/50 px-4";
                if (r.k === "ms") return (
                  <div key="ms" className={`${cell} bg-page text-xs font-semibold text-strong`} style={{ height: ROW }}>
                    <Diamond className="size-3 text-faint" aria-hidden />{p.milestonesLabel}<span className="font-normal text-faint">{p.milestoneCount ?? p.milestones.length}</span>
                  </div>
                );
                if (r.k === "group") return (
                  <div key={r.g.id} className={`${cell} bg-page text-xs font-semibold text-strong`} style={{ height: ROW }}>
                    <span className="size-1.5 rounded-full" style={{ background: TONE[r.g.tone] }} />{r.g.name}<span className="font-normal text-faint">{r.g.count}</span>
                  </div>
                );
                return (
                  <div key={r.t.id} className={cell} style={{ height: ROW }}>
                    <StatusIcon status={r.t.status} t={r.t.tone} />
                    <span className={`min-w-0 flex-1 truncate text-xs ${r.t.status === "done" ? "text-faint" : "text-body"}`}>{r.t.title}</span>
                    {r.t.sub && <span className="text-2xs text-faint">{r.t.sub}</span>}
                    <Avatar who={r.t.who} />
                  </div>
                );
              })}
            </div>

            {/* canvas */}
            <div className="relative overflow-hidden" style={{ width: W, height: H }}>
              {/* weekend shading + grid lines every 7 days */}
              {p.zoom === "weeks" && dayCells.filter((d) => d.weekend).map((d) => (
                <div key={d.i} className="absolute inset-y-0 bg-page/60" style={{ left: d.i * dw, width: dw }} />
              ))}
              {dayCells.filter((d) => d.i % 7 === 0).map((d) => (
                <div key={d.i} className="absolute inset-y-0 w-px bg-hairline/60" style={{ left: d.i * dw }} />
              ))}
              {rows.map((r, i) => (
                <div key={i} className={`absolute inset-x-0 border-b border-hairline/50 ${r.k === "task" ? "" : "bg-page/70"}`} style={{ top: i * ROW, height: ROW }} />
              ))}

              {/* dependencies */}
              <svg className="pointer-events-none absolute inset-0" width={W} height={H} aria-hidden>
                {p.deps.map((d) => {
                  const a = geo.get(d.from), b = geo.get(d.to);
                  if (!a || !b) return null;
                  const dx = Math.max(24, Math.abs(b.x1 - a.x2) / 2);
                  const dashed = b.x1 < a.x2;
                  return (
                    <g key={`${d.from}-${d.to}`} fill="none" stroke="var(--faint)" strokeWidth="1.3">
                      <path d={`M${a.x2} ${a.y} C${a.x2 + dx} ${a.y} ${b.x1 - dx} ${b.y} ${b.x1} ${b.y}`} strokeDasharray={dashed ? "3 3" : undefined} />
                      <path d={`M${b.x1 - 5} ${b.y - 4} L${b.x1} ${b.y} L${b.x1 - 5} ${b.y + 4}`} strokeLinecap="round" strokeLinejoin="round" />
                    </g>
                  );
                })}
              </svg>

              {/* bars */}
              {rows.map((r, i) => {
                if (r.k !== "task") return null;
                const t = r.t, top = i * ROW + (ROW - BAR) / 2;
                if (!t.start || !t.end) {
                  if (!t.noBar) return null;
                  const x = idx(p.start, t.noBarAt ?? p.start) * dw;
                  return <span key={t.id} className="absolute flex items-center text-2xs font-medium" style={{ left: x + 8, top, height: BAR, color: TONE[t.tone] }}>{t.noBar}</span>;
                }
                const left = idx(p.start, t.start) * dw, w = (idx(p.start, t.end) - idx(p.start, t.start)) * dw;
                const inside = w > INSIDE_MIN;
                return (
                  <div key={t.id}>
                    <m.div initial={{ opacity: 0 }} animate={{ opacity: t.status === "done" ? 0.6 : 1 }} transition={{ duration: 0.22 }}
                      className="absolute flex items-center gap-1.5 overflow-hidden rounded-control border border-[color-mix(in_oklab,var(--c)_45%,transparent)] bg-[color-mix(in_oklab,var(--c)_16%,var(--surface))] px-[3px] hover:border-[var(--c)]"
                      style={{ ...tone(t.tone), left, top, width: w, height: BAR }} title={t.title}>
                      {t.progress ? <span className="absolute inset-y-0 left-0 bg-[color-mix(in_oklab,var(--c)_26%,transparent)]" style={{ width: `${t.progress * 100}%` }} /> : null}
                      {inside && <span className="relative flex min-w-0 items-center gap-1.5"><Avatar who={t.who} size={16} /><span className="truncate text-2xs text-strong">{t.title}</span></span>}
                    </m.div>
                    {!inside && <span className="absolute flex items-center whitespace-nowrap text-2xs text-faint" style={{ left: left + w + 8, top, height: BAR }}>{t.title}</span>}
                  </div>
                );
              })}

              {/* milestones (lane = row 0) */}
              {[...msByDate].map(([date, list]) => {
                const x = idx(p.start, date) * dw + dw / 2;
                const label = list.find((l) => l.label)?.label;
                return (
                  <div key={date} className="absolute flex items-center" style={{ left: x - 6, top: (ROW - 12) / 2 }}>
                    <span className="size-3 rotate-45 bg-ripple" title={list.map((l) => l.label).filter(Boolean).join(", ")} />
                    {label && <span className="ml-3 whitespace-nowrap text-2xs text-body">{label}{list.length > 1 && ` +${list.length - 1}`}</span>}
                  </div>
                );
              })}

              {/* today */}
              {todayIdx >= 0 && todayIdx < p.days && (
                <div className="absolute inset-y-0 w-0.5 bg-ripple opacity-70" style={{ left: todayIdx * dw + dw / 2 - 1 }} />
              )}
              {taskCount === 0 && <p className="absolute inset-x-0 top-24 text-center text-xs text-faint">{p.emptyText}</p>}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
