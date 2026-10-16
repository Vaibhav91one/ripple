"use client";
// Obsidian UI (obsidianui.dev) Analytics Dashboard, MIT, see ../LICENSE. Restyled to Ripple tokens; prop-driven.
import type { ReactNode } from "react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { Digits } from "./number-animation";
import { Sparkline } from "./sparkline";
import { cx, type Tone } from "./tone";

export function KpiCard({
  label,
  value,
  format,
  delta,
  good,
  spark,
  sparkTone = "ripple",
  icon,
  index = 0,
  className,
}: {
  label: string;
  value: number | string;
  /** formats a numeric `value` (default en-US grouping) */
  format?: (value: number) => string;
  /** percent change; the sign picks the arrow */
  delta?: number;
  /** is the change good news? Default: delta > 0. Good paints covered, bad paints conflict. */
  good?: boolean;
  /** sparkline points */
  spark?: number[];
  sparkTone?: Tone;
  icon?: ReactNode;
  /** position in a row, staggers the reels */
  index?: number;
  className?: string;
}) {
  const isGood = good ?? (delta ?? 0) > 0;
  const tone: Tone = delta === 0 ? "neutral" : isGood ? "covered" : "conflict";
  return (
    <div className={cx("oa oa-stat", className)}>
      <span className="oa-stat-label">
        {icon && <span className="oa-stat-icon">{icon}</span>}
        {label}
      </span>
      <div className="oa-stat-row">
        <Digits value={value} format={format} delay={420 + index * 70} className="oa-stat-value" />
        {delta !== undefined && (
          <span className="oa-delta" data-tone={tone}>
            {delta < 0 ? <ArrowDownRight size={13} strokeWidth={2} /> : <ArrowUpRight size={13} strokeWidth={2} />}
            <Digits value={`${delta < 0 ? "−" : "+"}${Math.abs(delta)}%`} delay={500 + index * 70} />
          </span>
        )}
      </div>
      {spark && <Sparkline points={spark} tone={sparkTone} />}
    </div>
  );
}
