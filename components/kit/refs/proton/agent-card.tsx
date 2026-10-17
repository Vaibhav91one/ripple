"use client";
// AgentCard: a sandbox (or tool call) with a timer pill, a folder row, progress, the agent and what it is doing.
// CubeCard: the small dark meter card with a price pill and a folder row.
import { Box, Folder } from "lucide-react";
import { m } from "motion/react";

type PillTone = "conflict" | "gap" | "covered";
const PILL: Record<PillTone, string> = { conflict: "bg-conflict", gap: "bg-gap", covered: "bg-covered" };

export type AgentCardProps = {
  title: string;
  pill: string;
  pillTone?: PillTone;
  folder: string;
  folderNote: string;
  /** 0..1 */
  progress: number;
  agent: string;
  task: string;
  /** Glyph before the status (a braille spinner frame in the reference). */
  glyph: string;
  status: string;
  statusTone?: "body" | "gap";
};

export function AgentCard(p: AgentCardProps) {
  return (
    <div className="w-full max-w-[480px] overflow-hidden rounded-card border-[3px] border-hairline bg-surface shadow-sm">
      <div className="flex items-center justify-between border-b-2 border-hairline px-7 py-[18px]">
        <span className="font-mono text-lg text-body">{p.title}</span>
        <span className={`inline-flex items-center gap-2.5 rounded-full px-[18px] py-1.5 font-mono text-lg font-medium text-[var(--accent-ink)] ${PILL[p.pillTone ?? "conflict"]}`}>
          <span className="size-3.5 rounded-full bg-[var(--accent-ink)] opacity-70" aria-hidden />{p.pill}
        </span>
      </div>
      <div className="px-7 pb-6 pt-6">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-3 text-xl font-semibold tracking-[-0.01em] text-strong">
            <Folder className="size-[34px]" strokeWidth={2} aria-hidden />{p.folder}
          </span>
          <span className="font-mono text-lg text-faint">{p.folderNote}</span>
        </div>
        <div className="mt-3 h-[11px] overflow-hidden rounded-full bg-hairline" role="progressbar" aria-valuenow={Math.round(p.progress * 100)} aria-valuemin={0} aria-valuemax={100}>
          <m.div className="h-full origin-left rounded-full bg-faint" initial={{ scaleX: 0 }} animate={{ scaleX: p.progress }} transition={{ duration: 0.3, ease: [0.2, 0, 0, 1] }} />
        </div>
        <p className="mt-6 flex items-center gap-3 text-xl font-semibold tracking-[-0.01em] text-strong">
          <span className="size-5 rounded-full bg-gap" aria-hidden />{p.agent}
        </p>
        <p className="mt-2.5 text-lg text-body">{p.task}</p>
        <p className={`mt-3 flex items-center gap-2 font-mono text-xl ${p.statusTone === "gap" ? "text-gap" : "text-strong"}`} aria-live="polite">
          <span className="w-5 text-center" aria-hidden>{p.glyph}</span>{p.status}
        </p>
      </div>
    </div>
  );
}

export type CubeCardProps = { title: string; price: string; folder: string };

export function CubeCard(p: CubeCardProps) {
  const ink = "text-[var(--on-overlay,var(--strong))]";
  return (
    <div className={`w-[220px] overflow-hidden rounded-card bg-overlay ${ink}`}>
      <div className="flex items-center justify-between border-b border-hairline/30 px-4 py-[13px]">
        <span className="flex items-center gap-2 text-sm font-medium"><Box className="size-[15px]" aria-hidden />{p.title}</span>
        <span className="flex items-center gap-1.5 rounded-full bg-covered px-2 py-0.5 font-mono text-2xs font-medium text-[var(--accent-ink)]">
          <span className="size-[5px] rounded-full bg-[var(--accent-ink)]" aria-hidden />{p.price}
        </span>
      </div>
      <p className="flex items-center gap-2 px-4 pb-[34px] pt-3 text-sm font-medium"><Folder className="size-[15px]" aria-hidden />{p.folder}</p>
    </div>
  );
}
