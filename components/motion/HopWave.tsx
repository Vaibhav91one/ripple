"use client";

import { m, useReducedMotion } from "motion/react";
import { useImperativeHandle, useState, type Ref } from "react";
import { duration, ease, sec, stagger } from "@/lib/motion";

export type HopWaveHandle = { replay: () => void };

// One group per hop index; ring n starts n*140ms in. Reduced motion = no delay, no tween (instant, in order).
export function HopWave({ hops, ref, className }: { hops: React.ReactNode[]; ref?: Ref<HopWaveHandle>; className?: string }) {
  const [run, setRun] = useState(0);
  const reduce = useReducedMotion();
  useImperativeHandle(ref, () => ({ replay: () => setRun((n) => n + 1) }), []);
  return (
    <g key={run} className={className}>
      {hops.map((ring, n) => (
        <m.g
          key={n}
          initial="hidden"
          animate="show"
          variants={{ hidden: {}, show: { transition: { delayChildren: reduce ? 0 : sec(n * stagger.hop) } } }}
        >
          {ring}
        </m.g>
      ))}
    </g>
  );
}

const t = (ms: number, reduce: boolean | null) => ({ duration: reduce ? 0 : sec(ms), ease: ease.enter });

export function HopNode({ children }: { children: React.ReactNode }) {
  const reduce = useReducedMotion();
  return (
    <m.g
      style={{ transformBox: "fill-box", transformOrigin: "center" }}
      variants={{ hidden: { opacity: 0, scale: 0.85 }, show: { opacity: 1, scale: 1, transition: t(duration.node, reduce) } }}
    >
      {children}
    </m.g>
  );
}

export function HopEdge(props: Omit<React.ComponentProps<typeof m.path>, "variants">) {
  const reduce = useReducedMotion();
  return (
    <m.path
      {...props}
      variants={{ hidden: { pathLength: 0, opacity: 0 }, show: { pathLength: 1, opacity: 1, transition: t(duration.enter, reduce) } }}
    />
  );
}
