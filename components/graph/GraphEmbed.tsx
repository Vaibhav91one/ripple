"use client";

// A compact graph card body: the ripple of one change (GET /api/graph?d=) drawn by RippleGraph, with the node panel.
// Used by the case file, the Analytics graph section and the Assistant's "Show the graph" card.
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { fmtDate } from "@/components/panels/format";
import { GraphDownBanner } from "@/components/states/States";
import { isGraphDown } from "@/lib/api";
import type { GraphView } from "@/lib/graph/view";
import { getGraph } from "./api";
import { Legend } from "./Legend";
import { inspect } from "./model";
import { NodePanel } from "./NodePanel";
import { RippleGraph } from "./RippleGraph";

export function GraphEmbed({ d, team = null, height = 360, view: given }: { d: string; team?: string | null; height?: number; view?: GraphView }) {
  const [node, setNode] = useState<string | null>(null);
  const q = useQuery({ queryKey: ["graph", d, team, ""], queryFn: () => getGraph(d, { team }), enabled: !given });
  const data = given ?? q.data;
  if (q.error) return isGraphDown(q.error) ? <GraphDownBanner onRetry={() => void q.refetch()} /> : <p className="p-4 text-sm text-conflict-ink">Could not load the graph: {q.error.message}</p>;
  if (!data) return <div className="animate-pulse bg-raised/40" style={{ height }} aria-busy="true" aria-label="Loading the graph" />;
  const info = node ? inspect(data, node, fmtDate) : null;
  return (
    <div className="relative">
      <RippleGraph view={data} height={height} selected={node} onPick={setNode} label={`The ripple of ${data.decision.title}`} />
      <Legend className="pointer-events-none absolute bottom-3 left-3" />
      <NodePanel info={info} onSelect={setNode} onClose={() => setNode(null)} top="top-3" />
    </div>
  );
}
