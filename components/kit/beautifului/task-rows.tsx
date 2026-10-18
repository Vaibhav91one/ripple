// Beautiful UI (beautifului.dev), MIT, see ./LICENSE. Restyled to Ripple tokens.
"use client";

import "./kit.css";

import { useEffect, useState } from "react";

/* ─────────────────────────────────────────────────────────
 * TASK ROWS
 *
 *     0ms   rows enter staggered (80ms apart)
 *   600ms   row 1 ring sweeps 0 → 66%
 *  1500ms   row 1 expands — detail steps drop down
 *  3900ms   row 1 collapses; row 2 flips to Failed + retry
 *  5300ms   row 2 resolves to Completed
 * The status run completes once; task details stay clickable.
 * ───────────────────────────────────────────────────────── */

const TICKS = [600, 900, 2400, 1400, 2400, 600];

function useTick(intervals: number[]) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (tick >= intervals.length - 1) return;
    const t = setTimeout(() => setTick((x) => x + 1), intervals[tick]);
    return () => clearTimeout(t);
  }, [tick, intervals]);
  return tick;
}

function SpinnerRing({ active, children }: { active?: boolean; children?: React.ReactNode }) {
  const size = 24, stroke = 2;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <span className="relative inline-flex shrink-0 items-center justify-center" style={{ width: size, height: size }}>
      <svg
        width={size} height={size} className="absolute inset-0"
        style={active ? { animation: "spin 1.1s linear infinite" } : undefined}
      >
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--hairline)" strokeWidth={stroke} />
        {active && (
          <circle
            cx={size / 2} cy={size / 2} r={r} fill="none"
            stroke="var(--faint)" strokeWidth={stroke} strokeLinecap="round"
            strokeDasharray={`${c * 0.28} ${c * 0.72}`}
          />
        )}
      </svg>
      <span className="relative text-2xs font-semibold tabular-nums text-strong">{children}</span>
    </span>
  );
}

function Badge({ tone, children }: { tone: "red" | "green"; children: React.ReactNode }) {
  return (
    <span
      className={`flex size-5.5 shrink-0 items-center justify-center rounded-full text-page
        ${tone === "red" ? "bg-conflict" : "bg-covered"}`}
      style={{ animation: "pop-in 300ms cubic-bezier(0.23,1,0.32,1) both" }}
    >
      {children}
    </span>
  );
}

const XIcon = (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
);
const CheckIcon = (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
);
const RetryIcon = (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-2.64-6.36M21 3v6h-6" /></svg>
);

export type TaskRowStatus = "done" | "active" | "failed" | "pending";
export type TaskRowInput = {
  label: string;
  meta: string;
  status: TaskRowStatus;
  /** Optional line shown when the row expands. */
  detail?: string;
};

function fromInput(r: TaskRowInput, i: number) {
  return {
    key: `${i}-${r.label}`,
    badge:
      r.status === "done" ? <Badge tone="green">{CheckIcon}</Badge>
      : r.status === "failed" ? <Badge tone="red">{XIcon}</Badge>
      : <SpinnerRing active={r.status === "active"}>{i + 1}</SpinnerRing>,
    label: r.label,
    amount: r.meta,
    pill:
      r.status === "done" ? (
        <span className="inline-flex h-5.5 items-center rounded-full bg-covered-soft px-2 text-xs font-medium text-covered-ink">Completed</span>
      ) : r.status === "failed" ? (
        <span className="inline-flex h-5.5 items-center rounded-full bg-conflict-soft px-2 text-xs font-medium text-conflict-ink">Failed</span>
      ) : null,
    details: r.detail ? [{ label: r.detail, meta: "" }] : [],
  };
}

export default function TaskRows({ variant = "Capsules", rows: input }: { variant?: string; rows?: TaskRowInput[] }) {
  const tick = useTick(TICKS);
  const [manualOpen, setManualOpen] = useState<Record<string, boolean>>({});
  const row2: "pending" | "failed" | "done" = tick < 3 ? "pending" : tick === 3 ? "failed" : "done";

  const demo = [
    {
      key: "verify",
      badge: <Badge tone="green">{CheckIcon}</Badge>,
      label: "Traced RFC-14 reach",
      amount: "12 people",
      pill: (
        <span className="inline-flex h-5.5 items-center rounded-full bg-covered-soft px-2 text-xs font-medium text-covered-ink">
          Completed
        </span>
      ),
      details: [
        { label: "Matched people to artifacts", meta: "12/12" },
        { label: "Flagged stale promises", meta: "0" },
      ],
    },
    {
      key: "index",
      badge: <SpinnerRing active>2</SpinnerRing>,
      label: "Brief to Legal",
      amount: "6 artifacts",
      pill: null,
      details: [
        { label: "Reading contract MSA v3", meta: "3 files" },
        { label: "Scoring conflict risk", meta: "68%" },
      ],
    },
    {
      key: "draft",
      badge:
        row2 === "pending" ? (
          <SpinnerRing>3</SpinnerRing>
        ) : row2 === "failed" ? (
          <Badge tone="red">{XIcon}</Badge>
        ) : (
          <Badge tone="green">{CheckIcon}</Badge>
        ),
      label: "Draft notices",
      amount: "2 messages",
      pill:
        row2 === "failed" ? (
          <span className="inline-flex h-5.5 items-center gap-1.5 rounded-full bg-conflict-soft px-2 text-xs font-medium text-conflict-ink" style={{ animation: "fade-in 200ms ease-out both" }}>
            Failed <span style={{ animation: "spin 1.2s linear infinite" }} className="flex">{RetryIcon}</span>
          </span>
        ) : row2 === "done" ? (
          <span className="inline-flex h-5.5 items-center gap-1.5 rounded-full bg-covered-soft px-2 text-xs font-medium text-covered-ink" style={{ animation: "fade-in 200ms ease-out both" }}>
            Completed
          </span>
        ) : null,
      details: [
        { label: "Notice to Acme", meta: "draft" },
        { label: "Note to Sales", meta: "draft" },
      ],
    },
  ];

  const rows = input ? input.map(fromInput) : demo;
  const list = variant === "List";
  return (
    <div
      className={`flex w-full max-w-110 flex-col ${
        list ? "gap-0 self-start overflow-hidden rounded-xl bg-surface shadow-[var(--kit-shadow-card)]" : `${input ? "" : "min-h-[196px]"} gap-2`
      }`}
    >
      {rows.map((row, i) => {
        const open = manualOpen[row.key] ?? (!input && row.key === "index" && tick === 2);
        return (
          <div
            key={row.key}
            className={`self-stretch overflow-hidden transition-[border-radius] duration-300 ${
              list ? "border-b border-hairline last:border-0" : "bg-surface shadow-[var(--kit-shadow-card)]"
            }`}
            style={{
              borderRadius: list ? 0 : open ? 14 : 22,
              animation: `fade-up 450ms cubic-bezier(0.23,1,0.32,1) ${i * 80}ms both`,
            }}
          >
            <button
              type="button"
              aria-expanded={open}
              onClick={() => setManualOpen((current) => ({ ...current, [row.key]: !open }))}
              className="flex h-11 w-full items-center gap-2.5 px-2.5 text-left transition-colors duration-100 hover:bg-page"
            >
              <span className="flex size-6 shrink-0 items-center justify-center">
                {row.badge}
              </span>
              <span className="min-w-0 flex-1 truncate text-sm font-medium text-strong">
                {row.label}
              </span>
              <span className="text-sm text-body tabular-nums">{row.amount}</span>
              {row.pill}
              <span
                aria-hidden="true"
                className={`-ml-2 flex size-7 shrink-0 items-center justify-center rounded-full text-faint ${row.details.length ? "" : "invisible"}`}
              >
                <svg
                  width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
                  className="transition-transform duration-300"
                  style={{ transform: open ? "rotate(180deg)" : "rotate(0)" }}
                >
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </span>
            </button>

            {/* dropdown detail — same expandable grammar as Chain of Thought */}
            <div
              className="grid transition-[grid-template-rows,opacity] duration-300"
                style={{
                  gridTemplateRows: open ? "1fr" : "0fr",
                  opacity: open ? 1 : 0,
                  transitionTimingFunction: "cubic-bezier(0.23, 1, 0.32, 1)",
                }}
              >
                <div className="overflow-hidden">
                  <div className="mb-2.5 grid grid-cols-[24px_1fr] gap-2.5 px-2.5">
                    <span aria-hidden className="mx-auto h-full w-px bg-hairline" />
                    <div className="flex flex-col gap-1.5">
                      {row.details.map((d, j) => (
                        <div
                          key={d.label}
                          className="flex items-center justify-between"
                          style={
                            open
                              ? { animation: `fade-up 300ms cubic-bezier(0.23,1,0.32,1) ${120 + j * 100}ms both` }
                              : undefined
                          }
                        >
                          <span className="text-xs text-body">{d.label}</span>
                          <span className="font-mono text-xs text-faint tabular-nums">
                            {d.meta}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
          </div>
        );
      })}
    </div>
  );
}
