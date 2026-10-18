"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { parseAsArrayOf, parseAsString, parseAsStringLiteral, useQueryState } from "nuqs";
import { useMemo } from "react";
import { Search } from "lucide-react";
import { fmtDate } from "@/components/panels/format";
import { TEAM_TABS, useTeam } from "@/components/ripple/useTeam";
import { PageHeader } from "@/components/shell/PageHeader";
import { GraphDownBanner } from "@/components/states/States";
import { isGraphDown } from "@/lib/api";
import { EvidenceKind } from "@/lib/graph/view";
import { getGraphAll } from "./api";
import { findNode, toCanvas } from "./canvas";
import { Legend } from "./Legend";
import { inspect } from "./model";
import { NodePanel } from "./NodePanel";
import { RippleGraph } from "./RippleGraph";

const chip = (on: boolean) =>
  `h-8 rounded-full px-3 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-ripple ${on ? "bg-strong text-ink-on-strong" : "bg-raised text-body hover:text-strong"}`;

/** /graph: the whole company graph in FalkorDB, Obsidian style. Search, filters and the selected node live in the URL. */
export function GraphPage() {
  const [team, setTeam] = useTeam();
  const [kinds, setKinds] = useQueryState("kind", parseAsArrayOf(parseAsStringLiteral(EvidenceKind.options)).withDefault([]));
  const [q, setQ] = useQueryState("q", parseAsString.withDefault(""));
  const [node, setNode] = useQueryState("node", parseAsString);
  const { data, error, refetch } = useQuery({
    queryKey: ["graph-all", team, kinds.join()],
    queryFn: () => getGraphAll({ team, kinds }),
    placeholderData: keepPreviousData,
  });
  const g = useMemo(() => (data ? toCanvas(data) : null), [data]);
  const hit = g && q ? findNode(g, q) : null;
  const info = data && node ? inspect(data, node, fmtDate) : null;
  const toggle = (k: EvidenceKind) => {
    const next = kinds.includes(k) ? kinds.filter((x) => x !== k) : [...kinds, k];
    void setKinds(next.length ? next : null);
  };

  return (
    <>
      <PageHeader
        title="Graph"
        subtitle={g ? `${g.nodes.length} nodes and ${g.links.length} edges, read live from FalkorDB. Hover a dot to light up what it touches; click it to open it.` : "The company graph, read live from FalkorDB."}
      />
      <div role="toolbar" aria-label="Graph filters" className="mb-4 flex flex-wrap items-center gap-2">
        <label className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-faint" aria-hidden />
          <input
            type="search"
            value={q}
            onChange={(e) => void setQ(e.target.value || null)}
            onKeyDown={(e) => e.key === "Enter" && hit && void setNode(hit.key)}
            placeholder="Find a node"
            aria-label="Find a node"
            className="h-10 w-full rounded-control bg-raised pl-9 pr-3 text-sm text-strong placeholder:text-faint focus-visible:outline-2 focus-visible:outline-ripple"
          />
        </label>
        {q && <span className="text-sm text-faint" aria-live="polite">{hit ? `Showing ${hit.title}. Enter opens it.` : "No node matches."}</span>}
        <div role="group" aria-label="Node type" className="flex flex-wrap gap-1">
          {EvidenceKind.options.map((k) => (
            <button key={k} type="button" aria-pressed={kinds.includes(k)} onClick={() => toggle(k)} className={chip(kinds.includes(k))}>{k[0].toUpperCase() + k.slice(1)}</button>
          ))}
        </div>
        <div role="group" aria-label="Team" className="flex flex-wrap gap-1">
          <button type="button" aria-pressed={team === null} onClick={() => void setTeam(null)} className={chip(team === null)}>All teams</button>
          {TEAM_TABS.map((t) => (
            <button key={t.id} type="button" aria-pressed={team === t.id} onClick={() => void setTeam(team === t.id ? null : t.id)} className={chip(team === t.id)}>{t.label}</button>
          ))}
        </div>
      </div>

      <section aria-label="The company graph" className="relative overflow-hidden rounded-card border border-hairline bg-page">
        {error ? (
          <div className="p-6">{isGraphDown(error) ? <GraphDownBanner onRetry={() => void refetch()} /> : <p className="text-sm text-conflict-ink">Could not load the graph: {error.message}</p>}</div>
        ) : data ? (
          <RippleGraph view={data} height="max(480px, calc(100dvh - 300px))" selected={node} focus={hit?.key ?? null} onPick={(id) => void setNode(id)} label="The company graph" />
        ) : (
          <div className="h-[480px] animate-pulse bg-raised/40" aria-busy="true" aria-label="Loading the graph" />
        )}
        <Legend className="pointer-events-none absolute bottom-3 left-3" />
        <NodePanel info={info} onSelect={(id) => void setNode(id)} onClose={() => void setNode(null)} top="top-3" />
      </section>
    </>
  );
}
