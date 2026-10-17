"use client";

import { m, useReducedMotion } from "motion/react";
import { MARK } from "./Mark";
import { duration, ease, sec, stagger } from "@/lib/motion";

// Teams sitting on the arcs (viewBox 32 units). `gap` marks the break in the outer arc: the team nobody told.
const NODES = [
  { x: 10.95, y: 21.05, label: "Billing", side: "right" },
  { x: 17.26, y: 19.5, label: "Support", side: "right" },
  { x: 10.45, y: 13.78, label: "Legal", side: "right" },
  { x: 24.35, y: 21.08, label: "Sales", side: "left" },
  { x: 19.44, y: 12.56, label: "Field Ops · not told", side: "right", gap: true },
] as const;

const ORIGIN = { transformOrigin: "18.75% 81.25%", transformBox: "view-box" } as const;
const pct = (v: number) => `${(v / 32) * 100}%`;

/** The mark, large, with teams on the arcs. Arcs ripple outward once, then a faint ring keeps pulsing (frozen under reduced motion). */
export function RippleHero() {
  const reduce = useReducedMotion();
  const { dot, arcs } = MARK;
  return (
    <div className="relative mx-auto aspect-square w-full max-w-[460px]">
      <svg viewBox="0 0 32 32" fill="none" strokeWidth=".3" strokeLinecap="round" className="size-full overflow-visible" aria-hidden>
        <circle cx={dot.x} cy={dot.y} r={dot.r * 0.4} className="fill-ripple" />
        {arcs.map((segs, n) => (
          <m.g
            key={n}
            style={ORIGIN}
            className={n === 2 ? "stroke-gap" : "stroke-ripple"}
            initial={{ opacity: 0, scale: 0.55 }}
            animate={{ opacity: [0.9, 0.65, 1][n], scale: 1 }}
            transition={{ duration: sec(duration.long), delay: sec(n * stagger.hop * 2), ease: ease.enter }}
          >
            {segs.map((d) => <path key={d} d={d} />)}
          </m.g>
        ))}
        {!reduce && (
          <m.path
            d={arcs[1][0]}
            style={ORIGIN}
            className="stroke-ripple"
            initial={{ opacity: 0.5, scale: 0.4 }}
            animate={{ opacity: 0, scale: 1.45 }}
            transition={{ duration: sec(duration.loop * 3), ease: ease.enter, repeat: Infinity, repeatDelay: sec(duration.loop) }}
          />
        )}
        {NODES.map((n) => (
          <m.circle
            key={n.label}
            cx={n.x}
            cy={n.y}
            r=".4"
            className={"gap" in n ? "fill-gap" : "fill-ripple"}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: sec(duration.enter), delay: sec(duration.long + stagger.hop * 2), ease: ease.enter }}
          />
        ))}
      </svg>
      {NODES.map((n) => (
        <span
          key={n.label}
          className={`absolute whitespace-nowrap rounded-chip border px-1.5 py-0.5 text-3xs sm:text-2xs ${"gap" in n ? "border-gap/40 bg-gap-soft text-gap" : "border-hairline bg-surface text-body"}`}
          style={{ left: pct(n.x), top: pct(n.y), transform: `translate(${n.side === "left" ? "calc(-100% - 10px)" : "10px"}, -50%)` }}
        >
          {n.label}
        </span>
      ))}
    </div>
  );
}
