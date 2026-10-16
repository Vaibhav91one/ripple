// Beautiful UI (beautifului.dev), MIT, see ./LICENSE. Restyled to Ripple tokens.
"use client";

import "./kit.css";

import { useState } from "react";

/* ─────────────────────────────────────────────────────────
 * FILTER TABLE
 * Status chips directly filter the task table.
 * ───────────────────────────────────────────────────────── */

type Status = "todo" | "progress" | "done";

export type FilterChip = { key: string; label: string; dot?: string; count?: number };
export type FilterColumn<R> = { header: string; cell: (row: R) => React.ReactNode };

export type FilterTableProps<R> = {
  /** chips above the table; pass [] to hide them (e.g. when a Segmented drives `value`) */
  filters: FilterChip[];
  columns: FilterColumn<R>[];
  rows: R[];
  rowKey: (row: R) => string;
  /** does `row` belong under filter `key`? ("all" always shows every row) */
  matches: (row: R, key: string) => boolean;
  /** controlled filter; omit to let the chips keep their own state */
  value?: string;
  onChange?: (key: string) => void;
  /** grid-template-columns shared by the header and every row */
  grid?: string;
  minWidth?: number;
  className?: string;
  ariaLabel?: string;
  empty?: string;
};

type DemoRow = { task: string; date: string; status: Status; owner: string };

const DEMO_PILLS: Record<Status, { label: string; cls: string }> = {
  todo: { label: "To do", cls: "filter-status-todo" },
  progress: { label: "In Progress", cls: "filter-status-progress" },
  done: { label: "Completed", cls: "filter-status-done" },
};

const DEMO_ROWS: DemoRow[] = [
  { task: "Brief to Legal", date: "Dec 03", status: "todo", owner: "Legal" },
  { task: "Update clause 7.2", date: "Sep 22", status: "progress", owner: "Sales" },
  { task: "Notify Acme", date: "Jan 02", status: "todo", owner: "Customer success" },
  { task: "Review RFC-14", date: "Nov 08", status: "progress", owner: "Engineering" },
  { task: "Move launch date", date: "Apr 14", status: "done", owner: "Product" },
];

const DEMO: FilterTableProps<DemoRow> = {
  filters: [
    { key: "all", label: "All", count: 5 },
    { key: "todo", label: "To do", dot: "var(--gap)", count: 2 },
    { key: "progress", label: "In Progress", dot: "var(--ripple)", count: 2 },
    { key: "done", label: "Completed", dot: "var(--covered)", count: 1 },
  ],
  columns: [
    { header: "Task name", cell: (r) => <span className="truncate font-medium text-strong">{r.task}</span> },
    { header: "Date", cell: (r) => <span className="text-body tabular-nums">{r.date}</span> },
    {
      header: "Status",
      cell: (r) => (
        <span className={`inline-flex h-5 items-center rounded-[5px] px-1.5 text-[11px] font-medium ${DEMO_PILLS[r.status].cls}`}>
          {DEMO_PILLS[r.status].label}
        </span>
      ),
    },
    { header: "Advisor", cell: (r) => <span className="truncate text-body">{r.owner}</span> },
  ],
  rows: DEMO_ROWS,
  rowKey: (r) => r.task,
  matches: (r, key) => r.status === key,
  grid: "1.3fr 0.6fr 0.95fr 0.9fr",
  minWidth: 420,
  className: "w-full max-w-105",
  ariaLabel: "Scrollable task table",
};

/** With no props it renders the original task demo (the styleguide); otherwise it is a generic filterable table. */
export default function FilterTable<R = DemoRow>(props: Partial<FilterTableProps<R>>) {
  const p = (props.rows ? props : DEMO) as FilterTableProps<R>;
  const [own, setOwn] = useState("all");
  const filter = p.value ?? own;
  const grid = p.grid ?? `repeat(${p.columns.length}, minmax(0, 1fr))`;
  const count = (key: string) => (key === "all" ? p.rows.length : p.rows.filter((r) => p.matches(r, key)).length);
  const shownRows = p.rows.filter((r) => filter === "all" || p.matches(r, filter));

  return (
    <div className={p.className ?? "w-full"}>
      {/* filter chips */}
      {p.filters.length > 0 && (
        <div
          className="-mx-1 mb-1 flex items-center gap-1 overflow-x-auto px-1 py-1"
          style={{ scrollbarWidth: "none" }}
        >
          {p.filters.map((f) => {
            const active = filter === f.key;
            return (
              <button
                key={f.key}
                type="button"
                aria-pressed={active}
                onClick={() => (p.onChange ? p.onChange(f.key) : setOwn(f.key))}
                className={`flex h-6.5 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-[12px]
                  font-medium transition-[background-color,box-shadow,color] duration-200
                  ${active ? "bg-surface text-strong shadow-[var(--kit-shadow-btn)]" : "text-body hover:bg-raised"}`}
              >
                {f.dot && <span className="size-1.5 rounded-full" style={{ background: f.dot }} />}
                {f.label}
                <span
                  className={`rounded-[4px] px-1 text-[10.5px] tabular-nums
                    ${active ? "bg-raised text-body" : "text-faint"}`}
                >
                  {f.count ?? count(f.key)}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* table */}
      <div
        aria-label={p.ariaLabel ?? "Scrollable table"}
        className="overflow-x-auto rounded-xl bg-surface shadow-[var(--kit-shadow-card)]"
        role="region"
        tabIndex={0}
        style={{ scrollbarWidth: "none" }}
      >
        <div style={{ minWidth: p.minWidth ?? 420 }}>
          <div className="grid border-b border-hairline px-3 py-2 text-[11.5px] font-medium text-faint" style={{ gridTemplateColumns: grid }}>
            {p.columns.map((c) => <span key={c.header}>{c.header}</span>)}
          </div>
          {shownRows.length === 0 && <p className="px-3 py-4 text-[12px] text-faint">{p.empty ?? "Nothing here."}</p>}
          {p.rows.map((row) => {
            const shown = filter === "all" || p.matches(row, filter);
            return (
              <div
                key={p.rowKey(row)}
                className="grid transition-[grid-template-rows,opacity] duration-300"
                style={{
                  gridTemplateRows: shown ? "1fr" : "0fr",
                  opacity: shown ? 1 : 0,
                  transitionTimingFunction: "cubic-bezier(0.23, 1, 0.32, 1)",
                }}
              >
                <div className="overflow-hidden">
                  <div
                    className="grid items-center gap-x-2 border-b border-hairline px-3 py-2 text-[12px] transition-colors duration-100 last:border-0 hover:bg-raised"
                    style={{ gridTemplateColumns: grid }}
                  >
                    {p.columns.map((c) => <div key={c.header} className="min-w-0 truncate">{c.cell(row)}</div>)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
