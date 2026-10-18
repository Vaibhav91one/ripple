"use client";

import { useQuery } from "@tanstack/react-query";
import { parseAsArrayOf, parseAsString, parseAsStringLiteral, useQueryState } from "nuqs";
import { useId, useState } from "react";
import { Code2, Search, SlidersHorizontal } from "lucide-react";
import { useDecisionId } from "@/components/ripple/useDecisionId";
import { TEAM_TABS, useTeam } from "@/components/ripple/useTeam";
import { getDecisions } from "@/lib/api";
import { EvidenceKind } from "@/lib/graph/view";

export const useKinds = () => useQueryState("kinds", parseAsArrayOf(parseAsStringLiteral(EvidenceKind.options)).withDefault([]));
export const useSearch = () => useQueryState("q", parseAsString.withDefault(""));

const chip = (on: boolean) =>
  `h-7 rounded-md px-2.5 text-xs transition-colors focus-visible:outline-2 focus-visible:outline-ripple ${on ? "bg-ripple-soft text-ripple" : "bg-raised text-body hover:text-strong"}`;

/** Floating toolbar: decision picker (?d=), node-kind chips (?kinds=), team lens (?team=), search (?q=), Cypher toggle. */
export function GraphToolbar({ cypher, onCypher }: { cypher: boolean; onCypher: () => void }) {
  const [d, setD] = useDecisionId();
  const [team, setTeam] = useTeam();
  const [kinds, setKinds] = useKinds();
  const [q, setQ] = useSearch();
  const [open, setOpen] = useState(false);
  const panel = useId();
  const active = kinds.length + (team ? 1 : 0) + (q ? 1 : 0);
  const { data: decisions = [] } = useQuery({ queryKey: ["decisions"], queryFn: getDecisions });
  const toggle = (k: EvidenceKind) => {
    const next = kinds.includes(k) ? kinds.filter((x) => x !== k) : [...kinds, k];
    void setKinds(next.length ? next : null);
  };

  return (
    <div role="toolbar" aria-label="Graph filters" className="absolute left-3 top-3 z-10 flex max-w-[calc(100%-1.5rem)] flex-wrap items-center gap-x-3 gap-y-2 rounded-xl bg-surface px-3 py-2 shadow-[var(--kit-shadow-overlay)]">
      {/* phones: one button, the filters open under it */}
      <button aria-expanded={open} aria-controls={panel} onClick={() => setOpen(!open)} className={`${chip(open)} inline-flex items-center gap-1.5 sm:hidden`}>
        <SlidersHorizontal className="size-3.5" /> Filters{active ? ` · ${active}` : ""}
      </button>
      <div id={panel} className={`${open ? "flex" : "hidden"} w-full flex-wrap items-center gap-x-3 gap-y-2 sm:contents`}>
      <select
        aria-label="Decision"
        value={d}
        onChange={(e) => void setD(e.target.value)}
        className="h-7 max-w-44 rounded-md border border-hairline bg-page px-2 text-xs text-strong focus-visible:outline-2 focus-visible:outline-ripple"
      >
        {decisions.length === 0 && <option value={d}>{d}</option>}
        {decisions.map((x) => (
          <option key={x.id} value={x.id}>{x.title}</option>
        ))}
      </select>

      <div role="group" aria-label="Evidence kinds" className="flex items-center gap-1">
        {EvidenceKind.options.map((k) => (
          <button key={k} aria-pressed={kinds.includes(k)} onClick={() => toggle(k)} className={chip(kinds.includes(k))}>
            {k}
          </button>
        ))}
      </div>

      <div role="group" aria-label="Team lens" className="flex items-center gap-1">
        <button aria-pressed={team === null} onClick={() => void setTeam(null)} className={chip(team === null)}>All</button>
        {TEAM_TABS.filter((t) => t.id !== "eng").map((t) => (
          <button key={t.id} aria-pressed={team === t.id} onClick={() => void setTeam(team === t.id ? null : t.id)} className={chip(team === t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      <label className="relative">
        <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-faint" />
        <input
          type="search"
          value={q}
          onChange={(e) => void setQ(e.target.value || null)}
          placeholder="Search the graph"
          aria-label="Search the graph"
          className="h-7 w-36 rounded-md border border-hairline bg-page pl-7 pr-2 text-xs text-strong placeholder:text-faint focus-visible:outline-2 focus-visible:outline-ripple"
        />
      </label>

      <button aria-pressed={cypher} onClick={onCypher} className={`${chip(cypher)} inline-flex items-center gap-1.5`}>
        <Code2 className="size-3.5" /> Cypher used
      </button>
      </div>
    </div>
  );
}
