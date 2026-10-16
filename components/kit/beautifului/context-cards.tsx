// Beautiful UI (beautifului.dev), MIT, see ./LICENSE. Restyled to Ripple tokens.
"use client";

import "./kit.css";

import { useEffect, useState } from "react";

/* ─────────────────────────────────────────────────────────
 * CONTEXT CARDS
 * Retrieved chunks enter once, then remain available.
 * ───────────────────────────────────────────────────────── */

const CHUNKS = [
  {
    title: "Delivery promise",
    chars: "212 characters",
    body: "Clause 7.2: delivery of the integration will complete by Oct 28, subject to written change notice.",
    source: "Acme MSA v3.pdf",
    badge: "PDF",
    tone: "bg-conflict",
  },
  {
    title: "Decision record",
    chars: "1,250 characters",
    body: "RFC-14 section 2: launch moves to Nov 3 so the billing migration can ship first.",
    source: "RFC-14.md",
    badge: "MD",
    tone: "bg-covered",
  },
];

type Chunk = (typeof CHUNKS)[number];

/** Card shell: header bar (title + right-hand meta) and a body slot. */
export function ContextCard({ title, meta, index = 0, children }: { title: React.ReactNode; meta?: React.ReactNode; index?: number; children: React.ReactNode }) {
  return (
    <div
      className="overflow-hidden rounded-xl bg-surface shadow-[var(--kit-shadow-card)]"
      style={{ animation: `fade-up 400ms cubic-bezier(0.23,1,0.32,1) ${index * 100}ms both` }}
    >
      <div className="primitive-card-bar flex items-center gap-2.5 border-b border-hairline">
        <span className="flex min-w-0 items-center gap-1.5 text-[13px] font-medium text-strong">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M4 6h16M4 12h16M4 18h10" /></svg>
          <span className="truncate">{title}</span>
        </span>
        <span className="ml-auto shrink-0 text-[12px] text-faint tabular-nums">{meta}</span>
      </div>
      {children}
    </div>
  );
}

/** Source chip: badge tile + label + arrow. Fades in once `shown`. */
export function ContextChip({ source, badge, tone, index = 0, shown = true, title }: { source: string; badge: string; tone: string; index?: number; shown?: boolean; title?: string }) {
  return (
    <span
      title={title}
      className="inline-flex h-6 items-center gap-1.5 rounded-full bg-page px-2
        text-[12px] font-medium text-body shadow-[var(--kit-shadow-btn)]
        transition-[opacity,transform,background-color] duration-300 hover:bg-raised"
      style={{
        opacity: shown ? 1 : 0,
        transform: shown ? "scale(1)" : "scale(0.95)",
        transitionTimingFunction: "cubic-bezier(0.23, 1, 0.32, 1)",
        transitionDelay: `${index * 80}ms`,
      }}
    >
      <span className={`flex size-3.5 items-center justify-center rounded-[4px] ${tone} text-[7px] font-bold text-page`}>{badge}</span>
      {source}
      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M7 17L17 7M7 7h10v10" /></svg>
    </span>
  );
}

export default function ContextCards({ chunks = CHUNKS }: { chunks?: Chunk[] }) {
  const [chipsShown, setChipsShown] = useState(false);

  useEffect(() => {
    const chips = setTimeout(() => setChipsShown(true), 700);
    return () => clearTimeout(chips);
  }, []);

  return (
    <div className="flex w-full max-w-95 flex-col gap-2">
      <div className="flex items-center gap-2 px-0.5" style={{ animation: "fade-in 400ms ease-out both" }}>
        <span className="text-[13px] font-semibold text-strong">All chunks</span>
        <span className="inline-flex h-5 items-center rounded-md bg-page px-1.5 text-[11.5px] font-medium text-body shadow-[var(--kit-shadow-hairline)] tabular-nums">
          32
        </span>
      </div>
      {chunks.map((chunk, i) => (
        <ContextCard key={chunk.title} title={chunk.title} meta={chunk.chars} index={i}>
          <p className="px-3 pt-2 pb-1 text-[12.5px] leading-relaxed text-body">{chunk.body}</p>
          <div className="px-3 pb-3">
            <ContextChip source={chunk.source} badge={chunk.badge} tone={chunk.tone} index={i} shown={chipsShown} />
          </div>
        </ContextCard>
      ))}
    </div>
  );
}
