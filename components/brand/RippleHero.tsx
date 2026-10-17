"use client";

import { m, useReducedMotion } from "motion/react";
import { MARK } from "./Mark";
import { duration, ease, sec, stagger } from "@/lib/motion";

// Rings are hops from the change in the centre (viewBox 32 units; the outer ring is the mark's). Chips sit on the rings at `angle` degrees.
const RINGS = [5, 9] as const;
const CHIPS = [
  { label: "Billing", ring: 5, angle: 270 },
  { label: "Support", ring: 9, angle: 20 },
  { label: "Legal", ring: 9, angle: 160 },
  { label: "Sales", ring: 13, angle: 235 },
  { label: "Field Ops · not told", ring: 13, angle: 45, gap: true },
] as const;

const ORIGIN = { transformOrigin: "50% 50%", transformBox: "view-box" } as const;
const at = (ring: number, deg: number) => ({
  left: `${((16 + ring * Math.cos((deg * Math.PI) / 180)) / 32) * 100}%`,
  top: `${((16 - ring * Math.sin((deg * Math.PI) / 180)) / 32) * 100}%`,
});
const chip = "absolute flex -translate-x-1/2 -translate-y-1/2 items-center gap-1.5 whitespace-nowrap rounded-chip border bg-surface px-1.5 py-0.5 text-3xs sm:px-2 sm:text-2xs";

/** The change at the centre, teams on the rings. Rings expand once, then a faint halo pulses (frozen under reduced motion). */
export function RippleHero() {
  const reduce = useReducedMotion();
  const { c, outerR } = MARK;
  const enter = (n: number) => ({
    initial: { opacity: 0, scale: 0.5 },
    animate: { opacity: 1, scale: 1 },
    transition: { duration: sec(duration.long), delay: sec(n * stagger.hop), ease: ease.enter },
  });
  return (
    <div className="relative mx-auto aspect-square w-full max-w-[460px]">
      <svg viewBox="0 0 32 32" fill="none" strokeWidth=".14" strokeLinecap="round" className="size-full overflow-visible" aria-hidden>
        {RINGS.map((r, n) => (
          <m.circle key={r} cx={c} cy={c} r={r} style={ORIGIN} className="stroke-ripple" strokeOpacity={0.55 - n * 0.15} {...enter(n)} />
        ))}
        <m.g style={ORIGIN} {...enter(RINGS.length)} strokeWidth=".2">
          <path d={MARK.outerTeal} className="stroke-ripple" strokeOpacity=".3" />
          <path d={MARK.outerAmber} className="stroke-gap" strokeWidth=".3" />
        </m.g>
        {!reduce && (
          <m.circle
            cx={c} cy={c} r={outerR} style={ORIGIN} className="stroke-ripple"
            initial={{ opacity: 0.3, scale: 1 }}
            animate={{ opacity: 0, scale: 1.12 }}
            transition={{ duration: sec(duration.loop * 3), ease: ease.enter, repeat: Infinity, repeatDelay: sec(duration.loop), delay: sec(duration.long * 2) }}
          />
        )}
      </svg>
      <m.span
        className={`${chip} border-ripple/60 font-medium text-strong`}
        style={at(0, 0)}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: sec(duration.enter), ease: ease.enter }}
      >
        <span className="size-1.5 rounded-full bg-ripple" aria-hidden />Sunset API v1
      </m.span>
      {CHIPS.map((n, i) => (
        <m.span
          key={n.label}
          className={`${chip} ${"gap" in n ? "border-gap/60 text-gap" : "border-hairline text-body"}`}
          style={at(n.ring, n.angle)}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: sec(duration.enter), delay: sec(duration.long + i * stagger.item), ease: ease.enter }}
        >
          <span className={`size-1.5 rounded-full ${"gap" in n ? "bg-gap" : "bg-ripple"}`} aria-hidden />{n.label}
        </m.span>
      ))}
    </div>
  );
}
