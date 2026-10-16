"use client";
// Obsidian UI (obsidianui.dev) Analytics Dashboard, MIT, see ../LICENSE. Restyled to Ripple tokens; the reveal is m.svg (transform + opacity).
import { useId } from "react";
import { m, useReducedMotion } from "motion/react";
import { cx, type Tone } from "./tone";

export function Sparkline({ points, tone = "ripple", width = 132, height = 34, className }: { points: number[]; tone?: Tone; width?: number; height?: number; className?: string }) {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const reduce = useReducedMotion();
  if (points.length < 2) return null;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const pts = points.map((v, i) => [(i / (points.length - 1)) * width, height - 3 - ((v - min) / (max - min || 1)) * (height - 8)]);
  // Quadratic smoothing through segment midpoints keeps the line soft without overshoot.
  let line = `M ${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const mx = (pts[i][0] + pts[i + 1][0]) / 2;
    const my = (pts[i][1] + pts[i + 1][1]) / 2;
    line += ` Q ${pts[i][0].toFixed(1)} ${pts[i][1].toFixed(1)} ${mx.toFixed(1)} ${my.toFixed(1)}`;
  }
  const last = pts[pts.length - 1];
  line += ` T ${last[0].toFixed(1)} ${last[1].toFixed(1)}`;
  const area = `${line} L ${width} ${height} L 0 ${height} Z`;

  return (
    <m.svg
      className={cx("oa oa-spark", className)}
      data-tone={tone}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      aria-hidden="true"
      style={{ transformOrigin: "0 50%" }}
      initial={reduce ? false : { opacity: 0, scaleX: 0.2 }}
      animate={{ opacity: 1, scaleX: 1 }}
      transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
    >
      <defs>
        <linearGradient id={`g${id}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="currentColor" stopOpacity="0.28" />
          <stop offset="1" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#g${id})`} />
      <path d={line} fill="none" stroke="currentColor" strokeWidth={1.6} vectorEffect="non-scaling-stroke" />
      <circle cx={last[0]} cy={last[1]} r={2.6} fill="currentColor" />
    </m.svg>
  );
}
