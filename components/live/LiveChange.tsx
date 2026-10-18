"use client";

import { useEffect, useRef, useState } from "react";
import { ToastStack, type Toast } from "@/components/kit/bencho/toast-stack";
import { AiStatus, type AiStatusState } from "@/components/kit/rareui/ai-status";
import { postChange } from "@/lib/api";
import type { RippleResult } from "@/lib/schemas";
import { applySunsetMove } from "./applySunsetMove";

const NEW_ON = Date.UTC(2027, 6, 15) / 1000; // Jul 15
const STEPS: { state: AiStatusState; label: string; at: number }[] = [
  { state: "researching", label: "Re-reading RFC-14", at: 600 },
  { state: "analyzing", label: "Re-running the ripple", at: 1600 },
  { state: "done", label: "Conflict resolved", at: 2600 },
];

const usd = (n: number) => (n ? `$${(n / 1000).toLocaleString("en-US")}k` : "$0");

export function LiveChange({
  result,
  onApplied,
  autoRun = false,
  online = true,
}: {
  result: RippleResult;
  onApplied?: (result: RippleResult) => void;
  autoRun?: boolean;
  /** POST /api/change moves the sunset on the graph; false keeps it client-side (demo pages). */
  online?: boolean;
}) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [step, setStep] = useState<number>(-1);
  const [after, setAfter] = useState<RippleResult | null>(null);
  const [running, setRunning] = useState(false);
  const timers = useRef<number[]>([]);
  const onAppliedRef = useRef(onApplied);
  useEffect(() => {
    onAppliedRef.current = onApplied;
  });

  useEffect(() => {
    const list = timers.current;
    return () => list.forEach((t) => window.clearTimeout(t));
  }, []);

  const simulate = () => {
    timers.current.forEach((t) => window.clearTimeout(t));
    setRunning(true);
    setStep(-1);
    setAfter(null);
    setToasts([{ id: "moved", kind: "info", title: "RFC-14 updated", body: "sunset moved to Jul 15" }]);
    const at = (ms: number, fn: () => void) => timers.current.push(window.setTimeout(fn, ms));
    STEPS.forEach((s, i) => at(s.at, () => setStep(i)));
    // online: the graph moves the sunset and re-runs the ripple while the steps play; fall back to the local move if it fails
    const moved = online
      ? postChange(result.decision.id, NEW_ON).catch(() => applySunsetMove(result, NEW_ON))
      : Promise.resolve(applySunsetMove(result, NEW_ON));
    at(3000, async () => {
      const next = await moved;
      setAfter(next);
      setRunning(false);
      setToasts((t) => [
        { id: "resolved", kind: "success", title: "Conflict resolved", body: `${result.counts.conflicts} to ${next.counts.conflicts} conflicts` },
        ...t,
      ]);
      onAppliedRef.current?.(next);
    });
  };

  const auto = useRef(autoRun);
  useEffect(() => {
    if (!auto.current) return;
    auto.current = false;
    simulate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cur = STEPS[step];
  return (
    <section className="flex flex-col gap-6" aria-label="Live change">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-strong">Sunset moved to Jul 15</h2>
          <p className="text-sm text-body">RFC-14 changes; the ripple re-runs on its own.</p>
        </div>
        <button
          type="button"
          onClick={simulate}
          disabled={running}
          className="h-9 rounded-full bg-ripple-ink px-4 text-sm font-medium text-ink-on-strong transition-opacity disabled:opacity-50"
        >
          Simulate change
        </button>
      </div>

      <div className="grid gap-6 md:grid-cols-[300px_1fr]">
        <div className="min-h-48">
          {toasts.length > 0 && (
            <ToastStack toasts={toasts} onDismiss={(id) => setToasts((t) => t.filter((x) => x.id !== id))} />
          )}
        </div>
        <div className="flex flex-col gap-4">
          <div className="min-h-8">
            {cur && <AiStatus state={cur.state} label={cur.label} timer={cur.state !== "done"} />}
          </div>
          <dl className="grid grid-cols-2 gap-3">
            <Stat label="Conflicts" before={result.counts.conflicts} after={after?.counts.conflicts} />
            {result.counts.arrAtRisk !== null && (
              <Stat label="ARR at risk" before={usd(result.counts.arrAtRisk)} after={after && after.counts.arrAtRisk !== null ? usd(after.counts.arrAtRisk) : undefined} />
            )}
          </dl>
        </div>
      </div>
    </section>
  );
}

function Stat({ label, before, after }: { label: string; before: string | number; after?: string | number }) {
  const done = after !== undefined;
  return (
    <div className="rounded-xl bg-surface p-4 shadow-[var(--kit-shadow-card)]">
      <dt className="text-xs text-faint">{label}</dt>
      <dd className="mt-1 flex items-baseline gap-2 text-2xl font-semibold tabular-nums">
        <span className={done ? "text-faint line-through" : "text-conflict-ink"}>{before}</span>
        {done && (
          <>
            <span className="text-faint" aria-hidden>→</span>
            <span className="text-covered-ink">{after}</span>
          </>
        )}
      </dd>
    </div>
  );
}
