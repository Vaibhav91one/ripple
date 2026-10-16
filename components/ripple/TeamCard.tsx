"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ContextCard, ContextChip } from "@/components/kit/beautifului/context-cards";
import { getSource } from "@/lib/api";
import type { RippleResult } from "@/lib/schemas";
import { useSourcePanel } from "@/components/panels/SourcePanel";
import { parseAsString, useQueryState } from "nuqs";

export type TeamStatus = "conflict" | "gap" | "covered";

const BADGE: Record<TeamStatus, { label: string; cls: string }> = {
  conflict: { label: "Conflict", cls: "bg-conflict-soft text-conflict" },
  gap: { label: "Not told", cls: "bg-gap-soft text-gap" },
  covered: { label: "Covered", cls: "bg-covered-soft text-covered" },
};

const KIND = { doc: "DOC", ticket: "TKT", message: "MSG", pr: "PR" } as const;

/** Source chip showing the artifact title; the verbatim quote is the tooltip. */
export function SourceChip({ artifactId, quote }: { artifactId: string; quote: string }) {
  const { data } = useQuery({ queryKey: ["source", artifactId], queryFn: () => getSource(artifactId) });
  const panel = useSourcePanel();
  return (
    <button type="button" onClick={() => panel.open(artifactId, quote)} aria-label={`Open source: ${data?.title ?? artifactId}`} className="rounded-full">
      <ContextChip source={data?.title ?? artifactId} badge={data ? KIND[data.kind] : "…"} tone="bg-ripple" title={quote} />
    </button>
  );
}

export function TeamCard({ name, status, team, cypher }: { name: string; status: TeamStatus; team: RippleResult["teams"][number]; cypher?: RippleResult["cypher"][number] }) {
  const [open, setOpen] = useState(false);
  const [, setConflict] = useQueryState("conflict", parseAsString);
  const badge = BADGE[status];
  return (
    <ContextCard title={name} meta={<span className={`inline-flex h-5 items-center rounded-md px-1.5 text-[11.5px] font-medium ${badge.cls}`}>{badge.label}</span>}>
      <ul className="px-3 py-2.5">
        {team.why.map((w) => (
          <li key={w.ref + w.reason} className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-body">
            <p>{w.reason}</p>
            <SourceChip artifactId={w.source.artifactId} quote={w.source.quote} />
          </li>
        ))}
      </ul>
      {status === "conflict" && (
        <div className="border-t border-hairline px-3 py-2">
          <button type="button" onClick={() => setConflict("open")} className="rounded-md bg-conflict-soft px-2.5 py-1 text-xs font-medium text-conflict hover:opacity-90">
            Resolve conflict
          </button>
        </div>
      )}
      {cypher && (
        <div className="border-t border-hairline px-3 py-1.5">
          <button
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            className="text-[11.5px] font-medium text-faint transition-colors hover:text-strong"
          >
            {open ? "Hide" : "Show"} Cypher used
          </button>
          {open && (
            <div className="mt-1.5 overflow-hidden rounded-lg bg-page">
              <div className="primitive-card-bar border-b border-hairline font-mono text-[12px] font-medium text-strong">{cypher.name}</div>
              <pre className="overflow-x-auto px-3 py-2.5 font-mono text-[11.5px] leading-[1.7] text-body">{cypher.text}</pre>
            </div>
          )}
        </div>
      )}
    </ContextCard>
  );
}
