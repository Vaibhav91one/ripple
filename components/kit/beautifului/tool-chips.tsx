// Beautiful UI (beautifului.dev), MIT, see ./LICENSE. Restyled to Ripple tokens.
"use client";

import "./kit.css";

import { useEffect, useState } from "react";

/* ─────────────────────────────────────────────────────────
 * TOOL CHIPS
 * An agent run as compact rows: tool calls with inline
 * chips, then file-diff chips summarizing the edits.
 * Hover a row to reveal its chevron; every row expands
 * to show what the tool actually did.
 * ───────────────────────────────────────────────────────── */

const STEP_MS = 700;

const Icons: Record<string, React.ReactNode> = {
  think: <path d="M12 2l2.4 7.2L22 12l-7.6 2.8L12 22l-2.4-7.2L2 12l7.6-2.8z" />,
  write: <g fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z" /></g>,
  run: <g fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 17l6-5-6-5M12 19h8" /></g>,
  read: <g fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /></g>,
};

type DetailLine = { text: string; tone?: "add" };
export type ToolRowData = {
  icon: string;
  label: string;
  chip: string;
  mono: boolean;
  detailMono: boolean;
  detail: DetailLine[];
  /** Replaces the detail lines when set (e.g. a code block). */
  body?: React.ReactNode;
  /** Right-aligned note, e.g. a row count. */
  meta?: string;
};
export type DiffChip = { file: string; add: number; del: number };

const ROWS: ToolRowData[] = [
  {
    icon: "think", label: "Thinking", chip: "Tracing RFC-14…", mono: false, detailMono: false,
    detail: [
      { text: "The date change reaches contracts first." },
      { text: "Two teams were never told." },
    ],
  },
  {
    icon: "write", label: "Write 204 lines", chip: "impact.ts", mono: true, detailMono: true,
    detail: [
      { text: "+ const edges = nodes.filter((s) => s.stale)", tone: "add" },
      { text: "+ return trace(edges, { hero: \"RFC-14\" })", tone: "add" },
    ],
  },
  {
    icon: "run", label: "Rebuild and verify", chip: "pnpm test", mono: true, detailMono: true,
    detail: [
      { text: "✓ built in 1.2s" },
      { text: "✓ 34 checks passed" },
    ],
  },
  {
    icon: "read", label: "Read image", chip: "reach-graph.png", mono: true, detailMono: false,
    detail: [
      { text: "1280 × 720 · graph, 11 nodes." },
      { text: "Legal is two hops from the change." },
    ],
  },
];

const DIFFS: DiffChip[] = [
  { file: "rfc-14.md", add: 13, del: 0 },
  { file: "impact.ts", add: 74, del: 41 },
  { file: "clause-7-2.md", add: 8, del: 2 },
];

export default function ToolChips({
  rows = ROWS,
  diffs = DIFFS,
  live = false,
  summary,
  defaultOpen = false,
  collapsed = false,
}: {
  rows?: ToolRowData[];
  diffs?: DiffChip[];
  /** Rows arrive from outside: show them all at once, no replay timer. */
  live?: boolean;
  summary?: string;
  /** Start with every row expanded. */
  defaultOpen?: boolean;
  /** Start with the whole trace folded to its summary line. */
  collapsed?: boolean;
}) {
  const [step, setStep] = useState(0);
  const [open, setOpen] = useState(!collapsed);
  const [openRows, setOpenRows] = useState<Set<string>>(() => new Set(defaultOpen ? rows.map((_, i) => String(i)) : []));
  const total = rows.length + 1; // rows, then diff chips

  useEffect(() => {
    if (live || step >= total) return;
    const t = setTimeout(() => setStep((s) => s + 1), STEP_MS);
    return () => clearTimeout(t);
  }, [step, total, live]);

  const toggleRow = (label: string) =>
    setOpenRows((current) => {
      const next = new Set(current);
      next.has(label) ? next.delete(label) : next.add(label);
      return next;
    });

  return (
    <div className={`w-full pb-1 ${live ? "" : "min-h-[220px] max-w-80"}`}>
      {/* collapsed run header */}
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="-mx-1.5 flex w-fit items-center gap-1.5 rounded-lg px-1.5 py-1 text-[12.5px] text-body transition-colors duration-100 hover:bg-overlay"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="transition-transform duration-200" style={{ transform: open ? "rotate(0deg)" : "rotate(-90deg)" }}>
          <path d="M6 9l6 6 6-6" />
        </svg>
        <span className="tabular-nums">{summary ?? "4 tool calls, 2 messages"}</span>
      </button>

      {/* tool call rows */}
      <div className="grid transition-[grid-template-rows,opacity] duration-300" style={{ gridTemplateRows: open ? "1fr" : "0fr", opacity: open ? 1 : 0 }}>
        {/* -mx-1 + px-1.5 keeps content at the same x while giving the
            row hover pills room inside this overflow-hidden clip box */}
        <div className="-mx-1 overflow-hidden px-1.5 pb-1">
        <div className="mt-1.5 flex flex-col gap-1">
          {(live ? rows : rows.slice(0, step)).map((row, ri) => {
            const rowOpen = openRows.has(String(ri));
            return (
            <div key={ri} style={{ animation: "fade-up 300ms cubic-bezier(0.23,1,0.32,1) both" }}>
              <button
                type="button"
                aria-expanded={rowOpen}
                onClick={() => toggleRow(String(ri))}
                className="group/row -mx-[3px] flex h-7 w-[calc(100%+6px)] min-w-0 items-center gap-2 rounded-lg px-[3px] text-left transition-colors duration-100 hover:bg-overlay"
              >
                <span className="relative flex size-4 shrink-0 items-center justify-center text-faint">
                  <svg
                    width="13" height="13" viewBox="0 0 24 24" fill={row.icon === "think" ? "currentColor" : "none"} stroke="currentColor"
                    className={`transition-opacity duration-100 group-hover/row:opacity-0 ${rowOpen ? "opacity-0" : ""}`}
                  >
                    {Icons[row.icon]}
                  </svg>
                  <svg
                    width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
                    className={`absolute transition-[opacity,transform] duration-150 group-hover/row:opacity-100 ${rowOpen ? "opacity-100" : "opacity-0"}`}
                    style={{ transform: rowOpen ? "rotate(0deg)" : "rotate(-90deg)" }}
                  >
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </span>
                <span className="shrink-0 text-[12.5px] font-medium text-strong">{row.label}</span>
                <span
                  className={`inline-flex h-5.5 min-w-0 flex-1 cursor-pointer items-center truncate rounded-md bg-overlay px-1.5
                    text-[11.5px] text-body shadow-[var(--kit-shadow-hairline)] transition-colors duration-100 hover:bg-overlay
                    dark:bg-raised dark:text-body dark:hover:bg-raised
                    ${row.mono ? "font-mono" : ""}`}
                >
                  {row.chip}
                </span>
                {row.meta && <span className="ml-auto shrink-0 text-[11.5px] tabular-nums text-faint">{row.meta}</span>}
              </button>

              {/* expanded detail */}
              <div
                className="grid transition-[grid-template-rows,opacity] duration-300"
                style={{ gridTemplateRows: rowOpen ? "1fr" : "0fr", opacity: rowOpen ? 1 : 0, transitionTimingFunction: "cubic-bezier(0.23, 1, 0.32, 1)" }}
              >
                <div className="min-h-0 overflow-hidden">
                  <div className="mt-0.5 mb-1 ml-2 flex flex-col gap-0.5 border-l border-hairline py-0.5 pl-3.5">
                    {row.body ?? row.detail.map((line) => (
                      <span
                        key={line.text}
                        className={`truncate text-[11.5px] leading-[1.6] ${row.detailMono ? "font-mono" : ""} ${line.tone === "add" ? "text-covered" : "text-body"}`}
                      >
                        {line.text}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            );
          })}
        </div>

      {/* file-diff chips */}
      {diffs.length > 0 && (live || step >= total) && (
        <div className="mt-2.5 flex max-w-full flex-wrap gap-1.5 border-t border-hairline pt-2.5">
          {diffs.map((d, i) => (
            <span
              key={d.file}
              className="inline-flex h-7 max-w-full cursor-pointer items-center gap-1.5 rounded-md
                bg-surface px-2 font-mono text-[11.5px] text-strong shadow-[var(--kit-shadow-btn)]
                transition-colors duration-100 hover:bg-raised"
              style={{ animation: `pop-in 250ms cubic-bezier(0.23,1,0.32,1) ${i * 80}ms both` }}
            >
              <span className="min-w-0 truncate">{d.file}</span>
              <span className="shrink-0 text-covered tabular-nums">+{d.add}</span>
              {d.del > 0 && <span className="shrink-0 text-conflict tabular-nums">−{d.del}</span>}
            </span>
          ))}
          {!live && <button
            type="button"
            className="inline-flex h-7 items-center rounded-md px-1.5 font-mono text-[11.5px] text-faint
              underline decoration-transparent underline-offset-2 transition-colors duration-100
              hover:text-body hover:decoration-current"
            style={{ animation: `fade-in 300ms ease-out ${diffs.length * 80}ms both` }}
          >
            +2 more
          </button>}
        </div>
      )}
        </div>
      </div>
    </div>
  );
}
