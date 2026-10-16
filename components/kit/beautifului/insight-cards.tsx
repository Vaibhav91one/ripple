// Beautiful UI (beautifului.dev), MIT, see ./LICENSE. Restyled to Ripple tokens.
"use client";

import "./kit.css";

import { useEffect, useMemo, useState } from "react";

/* ─────────────────────────────────────────────────────────
 * INSIGHT CARDS
 * Embedded mini-visualizations in an "Insights N ‹ ›"
 * carousel. Autoplay yields as soon as a person uses it.
 * ───────────────────────────────────────────────────────── */

const EASE = "cubic-bezier(0.16, 1, 0.3, 1)";

const formatPercent = (v: number) => `${v > 0 ? "+" : ""}${v.toFixed(2)}%`;
const formatMoney = (v: number) => `${Math.round(v).toLocaleString("en-US")} changes`;
const SNAPSHOT_END = Math.floor(Date.now() / 1000);

type LivelinePoint = { time: number; value: number };
type LivelineSeries = { id: string; data: LivelinePoint[]; color: string };

function makePoints(values: number[], gap = 6): LivelinePoint[] {
  return values.map((value, index) => ({
    time: SNAPSHOT_END - (values.length - 1 - index) * gap,
    value,
  }));
}

/* Minimal SVG line chart (replaces the original's \`liveline\` dependency). */
function Chart({ series, grid = false }: { series: LivelineSeries[]; grid?: boolean }) {
  const W = 300, H = 166, PT = 22, PB = 22;
  const all = series.flatMap((s) => s.data.map((p) => p.value));
  const min = Math.min(...all), max = Math.max(...all), span = max - min || 1;
  const x = (i: number, n: number) => (i / (n - 1)) * W;
  const y = (v: number) => PT + (1 - (v - min) / span) * (H - PT - PB);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="absolute inset-0 h-full w-full" aria-hidden>
      {grid && [0.25, 0.5, 0.75].map((t) => (
        <line key={t} x1={0} x2={W} y1={PT + t * (H - PT - PB)} y2={PT + t * (H - PT - PB)} stroke="var(--hairline)" strokeDasharray="2 4" vectorEffect="non-scaling-stroke" />
      ))}
      {series.map((s) => (
        <polyline key={s.id} fill="none" stroke={s.color} strokeWidth={2.25} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke"
          points={s.data.map((p, i) => `${x(i, s.data.length)},${y(p.value)}`).join(" ")} />
      ))}
    </svg>
  );
}

/* inline @entity mention */
function Entity({ name, tone }: { name: string; tone: string }) {
  return (
    <span className="inline-flex items-center gap-1 align-baseline font-medium text-strong">
      <span className={`inline-block size-2.5 rounded-full ${tone}`} />
      @{name}
    </span>
  );
}

function Mono({ children, tone }: { children: React.ReactNode; tone: "red" | "green" }) {
  return (
    <code className={`font-mono text-[11.5px] ${tone === "red" ? "text-conflict" : "text-covered"}`}>
      {children}
    </code>
  );
}

function chartIndexFromPointer(event: React.PointerEvent<HTMLDivElement>, pointCount: number) {
  const rect = event.currentTarget.getBoundingClientRect();
  const progress = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
  return Math.round(progress * (pointCount - 1));
}

function ChartTooltip({ rows }: { rows: { label: string; value: string; color: string }[] }) {
  return (
    <div className="insight-chart-tooltip">
      <span className="insight-chart-tooltip-time">Today, 12:00</span>
      {rows.map((row) => (
        <div key={row.label} className="insight-chart-tooltip-row">
          <span className="insight-chart-tooltip-label"><span className="insight-chart-tooltip-dot" style={{ background: row.color }} />{row.label}</span>
          <strong>{row.value}</strong>
        </div>
      ))}
    </div>
  );
}

/* 1 — return comparison: 2 series, legend + big deltas + line chart */
function CompareCard() {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const data = useMemo(
    () => ({
      gaps: makePoints([-2.9, -3.4, -3.05, -3.86, -3.52, -4.1, -3.82, -4.41]),
      covered: makePoints([0.22, 0.58, 0.42, 0.91, 0.76, 1.08, 0.96, 1.15]),
    }),
    [],
  );

  const latestGaps = data.gaps.at(-1)?.value ?? -4.41;
  const latestTold = data.covered.at(-1)?.value ?? 1.15;
  const series: LivelineSeries[] = useMemo(
    () => [
      {
        id: "gaps",
        label: "",
        data: data.gaps,
        value: latestGaps,
        color: "var(--gap)",
      },
      {
        id: "covered",
        label: "",
        data: data.covered,
        value: latestTold,
        color: "var(--ripple)",
      },
    ],
    [data.gaps, data.covered, latestGaps, latestTold],
  );

  return (
    <div className="min-h-[278px] rounded-xl bg-surface p-3 shadow-[var(--kit-shadow-hairline)]">
      <div className="flex items-center gap-4">
        {[
          {
            name: "Not told",
            delta: formatPercent(latestGaps),
            sub: "-14 people",
            tone: "red",
            dot: "bg-gap",
          },
          {
            name: "Told",
            delta: formatPercent(latestTold),
            sub: "+9 people",
            tone: "green",
            dot: "bg-ripple",
          },
        ].map((s) => (
          <div key={s.name} className="flex-1">
            <span className="flex items-center gap-1.5 text-[11.5px] text-body">
              <span className={`size-2 rounded-full ${s.dot}`} />
              {s.name}
            </span>
            <span className={`block text-[17px] font-semibold tracking-[-0.01em] tabular-nums ${s.tone === "red" ? "text-conflict" : "text-covered"}`}>
              {s.delta}
            </span>
            <Mono tone={s.tone as "red" | "green"}>{s.sub}</Mono>
          </div>
        ))}
      </div>
      <div className="mt-2 overflow-hidden rounded-lg bg-page shadow-[var(--kit-shadow-hairline)]">
        <div className="flex items-center justify-between border-b border-hairline px-2.5 py-1.5">
          <span className="text-[11px] text-faint tabular-nums">
            Trend snapshot
          </span>
          <span className="rounded-full bg-raised px-2 py-0.5 text-[10.5px] font-medium text-body">
            Snapshot
          </span>
        </div>
        <div
          className="insight-chart-stage relative h-[166px]"
          onPointerDown={(event) => setHoverIndex(chartIndexFromPointer(event, data.gaps.length))}
          onPointerMove={(event) => setHoverIndex(chartIndexFromPointer(event, data.gaps.length))}
          onPointerLeave={() => setHoverIndex(null)}
          onPointerCancel={() => setHoverIndex(null)}
          onPointerUp={() => setHoverIndex(null)}
        >
          <Chart series={series} />
          {hoverIndex !== null && <>
            <span className="insight-chart-cursor" style={{ left: `${(hoverIndex / (data.gaps.length - 1)) * 100}%` }} />
            <span className="insight-chart-tooltip-anchor" style={{ left: `${Math.min(Math.max((hoverIndex / (data.gaps.length - 1)) * 100, 28), 72)}%` }}>
              <ChartTooltip rows={[{ label: "Not told", value: formatPercent(data.gaps[hoverIndex].value), color: "var(--gap)" }, { label: "Told", value: formatPercent(data.covered[hoverIndex].value), color: "var(--ripple)" }]} />
            </span>
          </>}
        </div>
      </div>
    </div>
  );
}

/* 2 — anomaly: bars with threshold + big spent value */
function AnomalyCard() {
  const [metric, setMetric] = useState<"spend" | "usage">("spend");
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const spend = useMemo(
    () => makePoints([274, 289, 264, 307, 331, 1210, 1718, 2112], 7),
    [],
  );
  const usage = useMemo(
    () => makePoints([18, 19, 17, 21, 22, 58, 81, 96], 7),
    [],
  );

  const data = metric === "spend" ? spend : usage;
  const threshold = metric === "spend" ? "2,112 changes" : "82 notices";
  const moneyLabel = formatMoney(spend.at(-1)?.value ?? 2112);

  return (
    <div className="min-h-[278px] rounded-xl bg-surface p-3 shadow-[var(--kit-shadow-hairline)]">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-[12px] font-medium text-strong">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--conflict)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19V5M5 12l7-7 7 7" /></svg>
          Unusual change volume
        </span>
        <span className="rounded-full bg-raised px-2 py-0.5 text-[10.5px] font-medium text-body">
          Snapshot
        </span>
      </div>
      <div className="mt-2 overflow-hidden rounded-lg bg-page shadow-[var(--kit-shadow-hairline)]">
        <div className="flex items-center justify-between border-b border-hairline px-2.5 py-1.5">
          <span className="text-[11px] text-faint tabular-nums">
            {hoverIndex !== null
              ? metric === "spend"
                ? formatMoney(data[hoverIndex].value)
                : `${Math.round(data[hoverIndex].value)} notices`
              : `${threshold} threshold`}
          </span>
          <span className="flex rounded-full bg-raised p-0.5">
            {(["spend", "usage"] as const).map((item) => (
              <button
                key={item}
                type="button"
                aria-pressed={metric === item}
                onClick={() => setMetric(item)}
                className={`rounded-full px-2 py-0.5 text-[10.5px] font-medium transition-[background-color,color,box-shadow,transform] duration-150 active:scale-[0.96] ${
                  metric === item ? "bg-surface text-strong shadow-[var(--kit-shadow-btn)]" : "text-faint hover:text-body"
                }`}
              >
                {item === "spend" ? "Changes" : "Notices"}
              </button>
            ))}
          </span>
        </div>
        <div
          className="insight-chart-stage relative h-[166px]"
          onPointerDown={(event) => setHoverIndex(chartIndexFromPointer(event, data.length))}
          onPointerMove={(event) => setHoverIndex(chartIndexFromPointer(event, data.length))}
          onPointerLeave={() => setHoverIndex(null)}
          onPointerCancel={() => setHoverIndex(null)}
          onPointerUp={() => setHoverIndex(null)}
        >
          <Chart grid series={[{ id: metric, data, color: "var(--conflict)" }]} />
          {hoverIndex !== null && <>
            <span className="insight-chart-cursor" style={{ left: `${(hoverIndex / (data.length - 1)) * 100}%` }} />
            <span className="insight-chart-tooltip-anchor" style={{ left: `${Math.min(Math.max((hoverIndex / (data.length - 1)) * 100, 28), 72)}%` }}>
              <ChartTooltip rows={[{ label: metric === "spend" ? "Changes" : "Notices", value: metric === "spend" ? formatMoney(data[hoverIndex].value) : `${Math.round(data[hoverIndex].value)} notices`, color: "var(--conflict)" }]} />
            </span>
          </>}
        </div>
      </div>
      <div className="mt-1.5 flex items-baseline gap-2">
        <span className="text-[17px] font-semibold tracking-[-0.01em] text-strong tabular-nums">
          {moneyLabel} this week
        </span>
        <Mono tone="red">+1,834 changes</Mono>
        <span className="text-[11px] text-faint">vs 3 weeks</span>
      </div>
    </div>
  );
}

/* 3 — allocation: hero number + segmented bar + legend */
function AllocationCard() {
  const segments = [
    { name: "ENG", label: "Engineering", pct: 72.5, amount: "31 people", cls: "bg-gap", tone: "text-gap" },
    { name: "LGL", label: "Legal", pct: 22.8, amount: "10 people", cls: "bg-ripple", tone: "text-body" },
    { name: "SLS", label: "Sales", pct: 4.7, amount: "2 people", cls: "bg-covered", tone: "text-faint" },
  ];
  const [selected, setSelected] = useState(segments[0].name);
  const active = segments.find((segment) => segment.name === selected) ?? segments[0];

  return (
    <div className="min-h-[278px] rounded-xl bg-surface p-3 shadow-[var(--kit-shadow-hairline)]">
      <span className="flex items-center gap-1.5 text-[12px] font-medium text-strong">
        <span className="flex size-3.5 items-center justify-center rounded-full bg-gap text-[8px] font-bold text-page">
          E
        </span>
        Who the change touches
      </span>
      <span className="mt-1 block text-[20px] font-semibold tracking-[-0.01em] text-strong tabular-nums">
        {active.amount}
      </span>
      <div
        className="mt-3 flex h-9 gap-0.5 overflow-hidden rounded-full bg-raised p-0.5"
        role="group"
        aria-label="Allocation segments"
      >
        {segments.map((s) => (
          <button
            key={s.name}
            type="button"
            aria-pressed={selected === s.name}
            aria-label={`${s.label}: ${s.pct}%`}
            onClick={() => setSelected(s.name)}
            className={`relative h-full overflow-hidden rounded-full ${s.cls} transition-[opacity,transform,box-shadow] duration-300 active:scale-[0.98]`}
            style={{
              width: `${s.pct}%`,
              opacity: selected === s.name ? 1 : 0.58,
              boxShadow: selected === s.name ? "inset 0 0 0 1px color-mix(in oklab, var(--strong) 22%, transparent)" : undefined,
              transitionTimingFunction: EASE,
            }}
          >
            <span
              className="absolute inset-y-1 left-1 rounded-full bg-strong/20 transition-[width,opacity] duration-500"
              style={{
                width: selected === s.name ? "calc(100% - 8px)" : "0%",
                opacity: selected === s.name ? 1 : 0,
                transitionTimingFunction: EASE,
              }}
            />
          </button>
        ))}
      </div>
      <div className="mt-2 flex items-center gap-1.5">
        {segments.map((s) => (
          <button
            key={s.name}
            type="button"
            aria-pressed={selected === s.name}
            onClick={() => setSelected(s.name)}
            className={`flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[11px] transition-[background-color,color,transform] duration-150 active:scale-[0.96] ${
              selected === s.name ? "bg-raised text-strong" : "text-body hover:bg-raised hover:text-strong"
            }`}
          >
            <span className={`size-1.5 rounded-full ${s.cls}`} />
            {s.name} <span className="tabular-nums">{s.pct}%</span>
          </button>
        ))}
      </div>
      <div className="mt-3 min-h-16 rounded-lg bg-page px-2.5 py-2 shadow-[var(--kit-shadow-hairline)]">
        <span className={`block text-[11.5px] font-medium ${active.tone}`}>{active.label}</span>
        <span className="mt-1 block text-[11px] leading-relaxed text-faint">
          Share of the people reached by RFC-14. Selecting a segment changes the inspected team without moving the card.
        </span>
      </div>
    </div>
  );
}

const PAGES = [
  {
    key: "compare",
    prose: (
      <>
        The widest gap in <Entity name="Launch" tone="bg-gap" /> is
        Sales — <Mono tone="red">-14 people</Mono> not told about <Mono tone="red">RFC-14</Mono>.
      </>
    ),
    Card: CompareCard,
    pill: "Who should hear about RFC-14 first?",
  },
  {
    key: "anomaly",
    prose: (
      <>
        Unusual change volume on <span className="font-medium text-strong">Oct 13</span> —{" "}
        <Mono tone="red">+1,834 changes</Mono> above average.
      </>
    ),
    Card: AnomalyCard,
    pill: "Find what changed",
  },
  {
    key: "allocation",
    prose: (
      <>
        <Entity name="Engineering" tone="bg-gap" /> is{" "}
        <span className="font-medium text-strong">72.5%</span> of the people this change reaches.
      </>
    ),
    Card: AllocationCard,
    pill: "If we exclude Sales, what changes?",
  },
];

export default function InsightCards() {
  const [page, setPage] = useState(0);

  const move = (direction: -1 | 1) => {
    setPage((current) => (current + direction + PAGES.length) % PAGES.length);
  };

  const { prose, Card, pill } = PAGES[page];

  return (
    <div className="min-h-[408px] w-full max-w-86">
      {/* pager header */}
      <div className="flex items-center justify-between">
        <span className="flex items-baseline gap-1.5">
          <span className="text-[13px] font-semibold text-strong">Insights</span>
          <span className="text-[13px] text-faint tabular-nums">{PAGES.length}</span>
        </span>
        <span className="flex items-center gap-0.5">
          {(["M15 18l-6-6 6-6", "M9 6l6 6-6 6"] as const).map((d, i) => (
            <button
              key={i}
              aria-label={i === 0 ? "Previous insight" : "Next insight"}
              onClick={() => move(i === 0 ? -1 : 1)}
              className="flex size-6 items-center justify-center rounded-[6px] text-faint
                transition-[background-color,color,transform] duration-100 hover:bg-raised
                hover:text-strong active:scale-[0.96]"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d={d} />
              </svg>
            </button>
          ))}
        </span>
      </div>

      {/* page content — blurred crossfade */}
      <div
        className="transition-[opacity,filter] duration-250"
        style={{ opacity: 1, filter: "blur(0)" }}
      >
        <p className="mt-1.5 text-[12.5px] leading-relaxed text-body">{prose}</p>
        <div className="mt-2">
          <Card />
        </div>
        <button
          className="mt-2 rounded-full bg-surface px-3 py-1.5 text-left text-[12px] text-strong
            shadow-[var(--kit-shadow-btn)] transition-colors duration-100 hover:bg-raised"
        >
          {pill}
        </button>
      </div>
    </div>
  );
}
