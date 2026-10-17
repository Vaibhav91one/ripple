"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import Link from "next/link";
import { Maximize2 } from "lucide-react";
import { ContextCard, ContextChip } from "@/components/kit/beautifului/context-cards";
import { getSource } from "@/lib/api";
import type { RippleResult } from "@/lib/schemas";
import { restrictedLine, teamName } from "@/lib/permissions/classify";
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
export function SourceChip({ artifactId, quote, restricted }: { artifactId: string; quote: string; restricted?: string }) {
  if (restricted) return <span className="text-xs text-faint">Source restricted to {teamName(restricted)}</span>;
  return <OpenSourceChip artifactId={artifactId} quote={quote} />;
}
function OpenSourceChip({ artifactId, quote }: { artifactId: string; quote: string }) {
  const { data } = useQuery({ queryKey: ["source", artifactId], queryFn: () => getSource(artifactId) });
  const panel = useSourcePanel();
  return (
    <span className="inline-flex items-center gap-1">
      <button type="button" onClick={() => panel.open(artifactId, quote)} aria-label={`Open source: ${data?.title ?? artifactId}`} className="rounded-full">
        <ContextChip source={data?.title ?? artifactId} badge={data ? KIND[data.kind] : "…"} tone="bg-ripple" title={quote} />
      </button>
      {data && <Link href={`/items/${data.kind}/${encodeURIComponent(data.id)}`} aria-label={`Open full page: ${data.title}`} title="Open full page" className="rounded-sm p-0.5 text-faint hover:text-strong focus-visible:outline-2 focus-visible:outline-ripple transition-colors"><Maximize2 className="size-3" aria-hidden /></Link>}
    </span>
  );
}

export function TeamCard({ name, status, team, cypher, restricted = [] }: { name: string; status: TeamStatus; team: RippleResult["teams"][number]; cypher?: RippleResult["cypher"][number]; /** what this viewer may not see about this team, e.g. 2 contracts restricted to Legal */ restricted?: NonNullable<RippleResult["restricted"]> }) {
  const [open, setOpen] = useState(false);
  const [, setConflict] = useQueryState("conflict", parseAsString);
  const badge = BADGE[status];
  return (
    <ContextCard title={name} meta={<span className={`inline-flex h-5 items-center rounded-md px-1.5 text-[11.5px] font-medium ${badge.cls}`}>{badge.label}</span>}>
      <ul className="px-3 py-2.5">
        {team.why.map((w) => (
          <li key={w.ref + w.reason} className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-body">
            <p>{w.reason}</p>
            <SourceChip artifactId={w.source.artifactId} quote={w.source.quote} restricted={w.source.restricted} />
          </li>
        ))}
        {restricted.filter((r) => r.kind !== "source").map((r) => (
          <li key={r.kind} className="text-sm text-faint">{restrictedLine(r)}</li>
        ))}
      </ul>
      {status === "conflict" && (
        <div className="border-t border-hairline px-3 py-2">
          <button type="button" onClick={() => setConflict("open")} className="rounded-md bg-conflict-soft px-2.5 py-1 text-xs font-medium text-conflict hover:opacity-90 transition-opacity">
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
