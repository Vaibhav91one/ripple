// Beautiful UI (beautifului.dev), MIT, see ./LICENSE. Restyled to Ripple tokens.
"use client";

import "./kit.css";

import { useState } from "react";

/* ─────────────────────────────────────────────────────────
 * FILTER TABLE
 * Status chips directly filter the task table.
 * ───────────────────────────────────────────────────────── */

type Status = "todo" | "progress" | "done";

const FILTERS: { key: "all" | Status; label: string; dot?: string; count: number }[] = [
  { key: "all", label: "All", count: 5 },
  { key: "todo", label: "To do", dot: "var(--gap)", count: 2 },
  { key: "progress", label: "In Progress", dot: "var(--ripple)", count: 2 },
  { key: "done", label: "Completed", dot: "var(--covered)", count: 1 },
];

const ROWS: { task: string; date: string; status: Status; owner: string }[] = [
  { task: "Brief to Legal", date: "Dec 03", status: "todo", owner: "Legal" },
  { task: "Update clause 7.2", date: "Sep 22", status: "progress", owner: "Sales" },
  { task: "Notify Acme", date: "Jan 02", status: "todo", owner: "Customer success" },
  { task: "Review RFC-14", date: "Nov 08", status: "progress", owner: "Engineering" },
  { task: "Move launch date", date: "Apr 14", status: "done", owner: "Product" },
];

const PILLS: Record<Status, { label: string; cls: string }> = {
  todo: { label: "To do", cls: "filter-status-todo" },
  progress: { label: "In Progress", cls: "filter-status-progress" },
  done: { label: "Completed", cls: "filter-status-done" },
};

export default function FilterTable() {
  const [filter, setFilter] = useState<"all" | Status>("all");

  return (
    <div className="w-full max-w-105">
      {/* filter chips */}
      <div
        className="-mx-1 mb-1 flex items-center gap-1 overflow-x-auto px-1 py-1"
        style={{ scrollbarWidth: "none" }}
      >
        {FILTERS.map((f) => {
          const active = filter === f.key;
          return (
            <button
              key={f.key}
              type="button"
              aria-pressed={active}
              onClick={() => setFilter(f.key)}
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
                {f.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* table */}
      <div
        aria-label="Scrollable task table"
        className="overflow-x-auto rounded-xl bg-surface shadow-[var(--kit-shadow-card)]"
        role="region"
        tabIndex={0}
        style={{ scrollbarWidth: "none" }}
      >
        <div className="min-w-[420px]">
          <div className="grid grid-cols-[1.3fr_0.6fr_0.95fr_0.9fr] border-b border-hairline px-3 py-2 text-[11.5px] font-medium text-faint">
            <span>Task name</span>
            <span>Date</span>
            <span>Status</span>
            <span>Advisor</span>
          </div>
          {ROWS.map((row) => {
            const shown = filter === "all" || row.status === filter;
            const pill = PILLS[row.status];
            return (
              <div
                key={row.task}
                className="grid transition-[grid-template-rows,opacity] duration-300"
                style={{
                  gridTemplateRows: shown ? "1fr" : "0fr",
                  opacity: shown ? 1 : 0,
                  transitionTimingFunction: "cubic-bezier(0.23, 1, 0.32, 1)",
                }}
              >
                <div className="overflow-hidden">
                  <div
                    className="grid grid-cols-[1.3fr_0.6fr_0.95fr_0.9fr] items-center border-b
                      border-hairline px-3 py-2 text-[12px] transition-colors duration-100
                      last:border-0 hover:bg-raised"
                  >
                    <span className="truncate font-medium text-strong">{row.task}</span>
                    <span className="text-body tabular-nums">{row.date}</span>
                    <span>
                      <span
                        className={`inline-flex h-5 items-center rounded-[5px] px-1.5
                          text-[11px] font-medium ${pill.cls}`}
                      >
                        {pill.label}
                      </span>
                    </span>
                    <span className="truncate text-body">{row.owner}</span>
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
