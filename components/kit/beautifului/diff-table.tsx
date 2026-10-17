// Beautiful UI (beautifului.dev), MIT, see ./LICENSE. Restyled to Ripple tokens.
"use client";

import "./kit.css";

import { useEffect, useState } from "react";

/* ─────────────────────────────────────────────────────────
 * DIFF TABLE
 * The proposed edit plays once and rests on the completed diff.
 * ───────────────────────────────────────────────────────── */

function useStage(steps: number[]) {
  const [stage, setStage] = useState(0);
  useEffect(() => {
    if (stage >= steps.length) return;
    const t = setTimeout(() => setStage((s) => s + 1), steps[stage]);
    return () => clearTimeout(t);
  }, [stage, steps]);
  return stage;
}

export type DiffTone = "plain" | "removed" | "added" | "changed";
export type DiffRow = { id: string; cells: React.ReactNode[]; tone: DiffTone };
export type DiffColumn = { label: string; width: string };

const SAMPLE_COLUMNS: DiffColumn[] = [
  { label: "Item", width: "34%" },
  { label: "Source", width: "30%" },
  { label: "Value", width: "36%" },
];

/** The source pill used in the sample rows; export so other screens match. */
export function DiffChip({ label, dot = "bg-ripple", onClick, tone }: { label: string; dot?: string; onClick?: () => void; tone?: DiffTone }) {
  const cls = "inline-flex h-5.5 max-w-full items-center gap-1.5 rounded-full bg-page px-2 text-[11.5px] font-medium shadow-[var(--kit-shadow-hairline)] transition-opacity duration-400";
  const body = (
    <>
      <span className={`size-1.5 shrink-0 rounded-full ${dot}`} />
      <span className="truncate text-body">{label}</span>
    </>
  );
  const style = { opacity: tone === "removed" ? 0.55 : 1 };
  return onClick ? (
    <button type="button" onClick={onClick} className={`${cls} hover:bg-raised focus-visible:outline-2 focus-visible:outline-ripple transition-colors`} style={style}>{body}</button>
  ) : (
    <span className={cls} style={style}>{body}</span>
  );
}

export const SAMPLE_DIFF_ROWS: DiffRow[] = [
  { id: "Launch date", cells: ["Launch date", <DiffChip key="c" label="Contract" />, "Oct 28"], tone: "removed" },
  { id: "Delivery scope", cells: ["Delivery scope", <DiffChip key="c" label="Contract" />, "Full integration"], tone: "removed" },
  { id: "Billing cutover", cells: ["Billing cutover", <DiffChip key="c" label="RFC-14" dot="bg-gap" />, "Nov 3"], tone: "plain" },
  { id: "Launch date new", cells: ["Launch date", <DiffChip key="c" label="RFC-14 §2" dot="bg-covered" />, "Nov 3"], tone: "added" },
];

const TONE_COLOR: Record<DiffTone, string> = {
  plain: "var(--strong)",
  removed: "var(--conflict)",
  added: "var(--covered)",
  changed: "var(--gap)",
};
const TONE_BG: Partial<Record<DiffTone, string>> = {
  removed: "var(--conflict-soft)",
  added: "var(--covered-soft)",
  changed: "var(--gap-soft)",
};

export default function DiffTable({
  title = "Proposed launch change",
  columns = SAMPLE_COLUMNS,
  rows = SAMPLE_DIFF_ROWS,
  className = "max-w-95",
  animate = true,
}: {
  title?: string;
  columns?: DiffColumn[];
  rows?: DiffRow[];
  className?: string;
  /** Play the tint (and reveal the added rows) once; false rests on the completed diff. */
  animate?: boolean;
}) {
  const stage = useStage(animate ? [800, 1000, 1000] : []);
  // 0 plain · 2 red/amber tint · 3 added rows revealed
  const tinted = !animate || stage >= 2;
  const revealed = !animate || stage >= 3;
  const hasTone = (r: DiffRow) => r.tone === "removed" || r.tone === "changed";

  return (
    <div className={`w-full ${className}`}>
      <div className="relative overflow-hidden rounded-xl bg-surface shadow-[var(--kit-shadow-card)]">
        <div className="px-4 py-2.5 flex items-center justify-between border-b border-hairline">
          <span className="text-[12.5px] font-medium text-strong">{title}</span>
        </div>

        <table className="w-full table-fixed border-collapse text-left">
          <colgroup>
            {columns.map((c) => (
              <col key={c.label} style={{ width: c.width }} />
            ))}
          </colgroup>
          <thead>
            <tr className="border-b border-hairline">
              {columns.map((c) => (
                <th key={c.label} className="px-4 py-2.5 align-top text-[12px] font-medium text-faint">
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              if (row.tone === "added") {
                return (
                  <tr key={row.id}>
                    <td colSpan={columns.length} className="p-0">
                      <div
                        className="grid transition-[grid-template-rows,opacity] duration-400"
                        style={{
                          gridTemplateRows: revealed ? "1fr" : "0fr",
                          opacity: revealed ? 1 : 0,
                          transitionTimingFunction: "cubic-bezier(0.23, 1, 0.32, 1)",
                        }}
                      >
                        <div className="overflow-hidden" style={{ background: TONE_BG.added }}>
                          <div className="grid items-center border-t border-hairline" style={{ gridTemplateColumns: columns.map((c) => c.width).join(" ") }}>
                            {row.cells.map((cell, i) => (
                              <span key={i} className="px-4 py-2.5 align-top min-w-0 text-[13px] text-covered">
                                {cell}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              }
              const on = hasTone(row) && tinted;
              return (
                <tr
                  key={row.id}
                  className="border-b border-hairline transition-colors duration-400 last:border-0 hover:bg-raised"
                  style={{ background: on ? TONE_BG[row.tone] : undefined }}
                >
                  {row.cells.map((cell, i) => {
                    const last = i === row.cells.length - 1;
                    return (
                      <td
                        key={i}
                        className={`px-4 py-2.5 align-top tabular-nums transition-colors duration-400 ${i === 0 ? "text-[13px] font-medium" : "text-[12.5px]"}`}
                        style={{
                          color: i === 0 ? (on ? TONE_COLOR[row.tone] : "var(--strong)") : on && last ? TONE_COLOR[row.tone] : "var(--body)",
                          textDecorationLine: on && last && row.tone === "removed" && typeof cell === "string" ? "line-through" : "none",
                          textDecorationColor: "color-mix(in srgb, var(--conflict) 50%, transparent)",
                        }}
                      >
                        {cell}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
