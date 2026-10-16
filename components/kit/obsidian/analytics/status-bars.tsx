"use client";
// Obsidian UI (obsidianui.dev) Status Bars, MIT, see ../LICENSE. The original draws a 90-day uptime strip with a tooltip;
// this keeps its strip look (segmented cells, hover dims the rest, rise on mount) but takes rows of label + percent + tone.
import { m, useReducedMotion } from "motion/react";
import { Digits } from "./number-animation";
import { cx, type Tone } from "./tone";

export type StatusBarRow = { label: string; percent: number; tone: Tone };

export function StatusBars({ rows, cells = 30, className }: { rows: StatusBarRow[]; /** cells per strip */ cells?: number; className?: string }) {
  const reduce = useReducedMotion();
  return (
    <div className={cx("oa oa-sbars", className)}>
      {rows.map((r, row) => {
        const pct = Math.min(100, Math.max(0, r.percent));
        const on = Math.round((pct / 100) * cells);
        return (
          <div key={r.label} data-tone={r.tone}>
            <div className="oa-sbar-head">
              <span className="oa-sbar-label">{r.label}</span>
              <span className="oa-sbar-value">
                <i className="oa-sbar-dot" aria-hidden="true" />
                <Digits value={pct} delay={300 + row * 70} />%
              </span>
            </div>
            <div className="oa-sbar-strip" role="meter" aria-label={r.label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
              {Array.from({ length: cells }, (_, i) => (
                <m.span
                  key={i}
                  className="oa-sbar-cell"
                  data-on={i < on || undefined}
                  initial={reduce ? false : { scaleY: 0.3, opacity: 0 }}
                  animate={{ scaleY: 1, opacity: 1 }}
                  transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1], delay: row * 0.08 + i * 0.012 }}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
