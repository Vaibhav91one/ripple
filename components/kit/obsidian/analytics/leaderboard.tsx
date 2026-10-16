"use client";
// Obsidian UI (obsidianui.dev) Analytics Dashboard, MIT, see ../LICENSE. Restyled to Ripple tokens; share bars grow with m.span scaleX.
import type { ReactNode } from "react";
import { m, useReducedMotion } from "motion/react";
import { Avatar } from "./avatar";
import { Digits } from "./number-animation";
import { cx, type Tone } from "./tone";

export type LeaderRow = {
  id: string;
  name: string;
  value: number;
  avatar?: string;
  tone?: Tone;
  /** line under the bar */
  meta?: ReactNode;
};

export function Leaderboard({ rows, unit = "", className }: { rows: LeaderRow[]; /** word after the value, e.g. "commits" */ unit?: string; className?: string }) {
  const reduce = useReducedMotion();
  const top = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ol className={cx("oa oa-leaders", className)}>
      {rows.map((r, i) => (
        <li key={r.id} className="oa-leader" data-tone={r.tone ?? "ripple"}>
          <Avatar src={r.avatar} name={r.name} size={32} tone={r.tone ?? "ripple"} />
          <div className="oa-leader-main">
            <div className="oa-leader-line">
              <span className="oa-leader-name">{r.name}</span>
              <span className="oa-leader-count">
                <Digits value={r.value} delay={560 + i * 80} />
                {unit && ` ${unit}`}
              </span>
            </div>
            <div className="oa-share" aria-hidden="true">
              <m.span
                className="oa-share-fill"
                style={{ width: `${(r.value / top) * 100}%` }}
                initial={reduce ? false : { scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ duration: 0.7, ease: [0.23, 1, 0.32, 1], delay: 0.3 + i * 0.08 }}
              />
            </div>
            {r.meta && <div className="oa-leader-meta">{r.meta}</div>}
          </div>
        </li>
      ))}
    </ol>
  );
}
