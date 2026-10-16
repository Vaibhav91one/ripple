"use client";

import { animate, m, useMotionValue, useReducedMotion, useTransform } from "motion/react";
import { useEffect } from "react";
import { duration, ease, sec } from "@/lib/motion";

export function AnimatedCount({ value, className = "" }: { value: number; className?: string }) {
  const reduce = useReducedMotion();
  const mv = useMotionValue(value);
  const text = useTransform(mv, (v) => Math.round(v).toString());
  useEffect(() => {
    if (reduce) { mv.set(value); return; }
    const c = animate(mv, value, { duration: sec(duration.count), ease: ease.enter });
    return () => c.stop();
  }, [value, reduce, mv]);
  return <m.span className={`tabular-nums ${className}`}>{text}</m.span>;
}
