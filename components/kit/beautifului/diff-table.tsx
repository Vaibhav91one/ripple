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

const ROWS = [
  { id: "Launch date", dept: "Contract", email: "Oct 28", removed: true },
  { id: "Delivery scope", dept: "Contract", email: "Full integration", removed: true },
  { id: "Billing cutover", dept: "RFC-14", email: "Nov 3", removed: false },
];

const DOT: Record<string, string> = {
  Contract: "bg-ripple",
  "RFC-14": "bg-gap",
  Seasonal: "bg-gap",
};

export default function DiffTable() {
  const stage = useStage([800, 1000, 1000]);
  // 0 plain · 1 red tint · 2 completed diff
  const tinted = stage >= 2;
  const added = stage >= 3;

  return (
    <div className="w-full max-w-95">
      <div className="relative overflow-hidden rounded-xl bg-surface shadow-[var(--kit-shadow-card)]">
        <div className="primitive-card-bar flex items-center justify-between border-b border-hairline">
          <span className="text-[12.5px] font-medium text-strong">Proposed launch change</span>
        </div>

        <table className="w-full table-fixed border-collapse text-left">
          <colgroup>
            <col className="w-[34%]" />
            <col className="w-[30%]" />
            <col className="w-[36%]" />
          </colgroup>
          <thead>
            <tr className="border-b border-hairline">
              {["Item", "Source", "Value"].map((h) => (
                <th key={h} className="primitive-table-cell text-[12px] font-medium text-faint">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ROWS.map((row) => {
              const out = row.removed && tinted;
              return (
                <tr
                  key={row.id}
                  className="border-b border-hairline transition-colors duration-400 last:border-0 hover:bg-raised"
                  style={{ background: out ? "var(--conflict-soft)" : undefined }}
                >
                  <td
                    className="primitive-table-cell text-[13px] font-medium tabular-nums transition-colors duration-400"
                    style={{ color: out ? "var(--conflict)" : "var(--strong)" }}
                  >
                    {row.id}
                  </td>
                  <td className="primitive-table-cell">
                    <span
                      className="inline-flex h-5.5 items-center gap-1.5 rounded-full bg-page px-2 text-[11.5px] font-medium shadow-[var(--kit-shadow-hairline)] transition-opacity duration-400"
                      style={{ opacity: out ? 0.55 : 1 }}
                    >
                      <span className={`size-1.5 rounded-full ${DOT[row.dept]}`} />
                      <span className="text-body">{row.dept}</span>
                    </span>
                  </td>
                  <td
                    className="primitive-table-cell text-[12.5px] whitespace-nowrap transition-colors duration-400"
                    style={{
                      color: out ? "var(--conflict)" : "var(--body)",
                      textDecorationLine: out ? "line-through" : "none",
                      textDecorationColor: "color-mix(in srgb, var(--conflict) 50%, transparent)",
                    }}
                  >
                    {row.email}
                  </td>
                </tr>
              );
            })}
            {/* added row */}
            <tr>
              <td colSpan={3} className="p-0">
                <div
                  className="grid transition-[grid-template-rows,opacity] duration-400"
                  style={{
                    gridTemplateRows: added ? "1fr" : "0fr",
                    opacity: added ? 1 : 0,
                    transitionTimingFunction: "cubic-bezier(0.23, 1, 0.32, 1)",
                  }}
                >
                  <div className="overflow-hidden" style={{ background: "var(--covered-soft)" }}>
                    <div className="grid grid-cols-[34%_30%_36%] items-center border-t border-hairline">
                      <span className="primitive-table-cell text-[13px] font-medium text-covered tabular-nums">
                        Launch date
                      </span>
                      <span className="primitive-table-cell">
                        <span className="inline-flex h-5.5 items-center gap-1.5 rounded-full bg-surface px-2 text-[11.5px] font-medium shadow-[var(--kit-shadow-hairline)]">
                          <span className="size-1.5 rounded-full bg-covered" />
                          <span className="text-body">RFC-14 §2</span>
                        </span>
                      </span>
                      <span className="primitive-table-cell text-[13px] text-covered">
                        Nov 3
                      </span>
                    </div>
                  </div>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
