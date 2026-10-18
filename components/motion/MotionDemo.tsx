"use client";

import { useRef, useState } from "react";
import { AnimatedCount } from "./AnimatedCount";
import { CardEnter } from "./CardEnter";
import { GapChips } from "./GapChips";
import { HopEdge, HopNode, HopWave, type HopWaveHandle } from "./HopWave";

const btn = "rounded-md border border-hairline bg-raised px-3 py-1 text-sm text-strong";
const rings: [number, number][][] = [[[100, 100]], [[220, 50], [220, 150]], [[340, 25], [340, 100], [340, 175]]];
const initialChips = ["Legal", "Support", "Billing"].map((label) => ({ id: label, label }));

export function MotionDemo() {
  const wave = useRef<HopWaveHandle>(null);
  const [chips, setChips] = useState(initialChips);
  const [count, setCount] = useState(3);
  const hops = rings.map((ring, n) => (
    <g key={n}>
      {n > 0 && ring.map(([x, y], i) => {
        const [px, py] = rings[n - 1][Math.min(i, rings[n - 1].length - 1)];
        return <HopEdge key={`e${i}`} d={`M ${px} ${py} L ${x} ${y}`} className="stroke-ripple" strokeWidth={1.5} fill="none" />;
      })}
      {ring.map(([x, y], i) => (
        <HopNode key={`n${i}`}><circle cx={x} cy={y} r={12} className="fill-ripple-soft stroke-ripple" strokeWidth={1.5} /></HopNode>
      ))}
    </g>
  ));
  return (
    <section className="space-y-3">
      <h2 className="text-md">Motion</h2>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2 rounded-lg border border-hairline bg-surface p-3">
          <p className="text-xs text-faint">HopWave · rings 140ms apart</p>
          <svg viewBox="0 0 380 200" className="h-40 w-full"><HopWave ref={wave} hops={hops} /></svg>
          <button className={btn} onClick={() => wave.current?.replay()}>Replay</button>
        </div>
        <div className="space-y-2 rounded-lg border border-hairline bg-surface p-3">
          <p className="text-xs text-faint">CardEnter · 40ms stagger</p>
          <CardEnter>{["One", "Two", "Three"].map((c) => <div key={c} className="mb-2 rounded-md border border-hairline bg-raised p-3 text-strong">{c}</div>)}</CardEnter>
        </div>
        <div className="space-y-2 rounded-lg border border-hairline bg-surface p-3">
          <p className="text-xs text-faint">GapChips · exit 200ms + layout slide</p>
          <GapChips chips={chips} renderChip={(c) => (
            <span className="inline-flex items-center gap-1 rounded-full bg-gap-soft px-2 py-0.5 text-xs text-gap-ink">
              {c.label}
              <button aria-label={`Remove ${c.label}`} onClick={() => setChips((cs) => cs.filter((x) => x.id !== c.id))}>×</button>
            </span>
          )} />
          <button className={btn} onClick={() => setChips(initialChips)}>Reset</button>
        </div>
        <div className="space-y-2 rounded-lg border border-hairline bg-surface p-3">
          <p className="text-xs text-faint">AnimatedCount · 300ms</p>
          <p className="text-2xl text-strong"><AnimatedCount value={count} /> not told</p>
          <button className={btn} onClick={() => setCount((c) => c + 1)}>+1</button>
        </div>
      </div>
    </section>
  );
}
