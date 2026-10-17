"use client";
// Client state for AgentCard: the timer ticks every second and the spinner glyph cycles (frozen under reduced motion).
import { useEffect, useState } from "react";
import { AgentCard, type AgentCardProps } from "./agent-card";

const FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

export function AgentCardDemo({ startAt = 1, ...props }: Omit<AgentCardProps, "pill" | "glyph"> & { startAt?: number }) {
  const [sec, setSec] = useState(startAt);
  const [frame, setFrame] = useState(0);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const a = setInterval(() => setSec((s) => s + 1), 1000);
    const b = setInterval(() => setFrame((f) => (f + 1) % FRAMES.length), 90);
    return () => { clearInterval(a); clearInterval(b); };
  }, []);
  return <AgentCard {...props} pill={`${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`} glyph={FRAMES[frame]} />;
}
