"use client";

import { useMemo } from "react";
import { HopEdge, HopNode, HopWave } from "@/components/motion/HopWave";
import type { RippleResult } from "@/lib/schemas";
import { CENTER, place, RINGS, SIZE, type Placed } from "./geometry";

const NEUTRAL = { fill: "var(--raised)", stroke: "var(--faint)" };

function style(n: Placed, r: RippleResult) {
  if (n.kind === "decision") return { fill: "var(--ripple-soft)", stroke: "var(--ripple)" };
  if (n.kind === "system") return { fill: "var(--raised)", stroke: "var(--ripple)" };
  if (n.kind === "contract" && r.conflicts.some((c) => c.contractIds.includes(n.id)))
    return { fill: "var(--conflict-soft)", stroke: "var(--conflict)" };
  if (n.kind === "team") {
    const hasConflict = r.teams.some((t) => t.teamId === n.id && t.why.some((w) => r.conflicts.some((c) => c.contractIds.includes(w.ref))));
    if (r.gap.includes(n.id))
      return { fill: "var(--gap-soft)", stroke: hasConflict ? "var(--conflict)" : "var(--gap)" };
    return { fill: "var(--covered-soft)", stroke: "var(--covered)" };
  }
  return NEUTRAL;
}

export function RippleGraph({ data }: { data: RippleResult }) {
  const { nodes, edges } = useMemo(() => {
    const placed = place(data.nodes);
    const byId = new Map(placed.map((n) => [n.id, n]));
    return { nodes: placed.map((n) => ({ n, s: style(n, data) })), edges: edges_(data, byId) };
  }, [data]);

  const hops = [0, 1, 2, 3].map((h) => [
    ...edges.filter((e) => e.hop === h).map((e) => (
      <HopEdge key={e.key} d={e.d} fill="none" stroke={e.stroke} strokeWidth={e.conflict ? 1.5 : 1} opacity={e.conflict ? 0.9 : 0.35} />
    )),
    ...nodes.filter(({ n }) => Math.min(n.hop, 3) === h).map(({ n, s }) => (
      <HopNode key={n.id}>
        <circle cx={n.x} cy={n.y} r={n.r} fill={s.fill} stroke={s.stroke} strokeWidth={n.r > 10 ? 1.75 : 1.25} />
        {n.hop <= 1 || n.hop >= 3 ? (
          <text x={n.x} y={n.y + n.r + 14} textAnchor="middle" fontSize={12} fill="var(--body)">
            {n.hop === 0 ? "Sunset API v1" : n.label}
          </text>
        ) : null}
      </HopNode>
    )),
  ]);

  return (
    <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="h-full w-full" role="img" aria-label="Ripple graph: decision, system, customers, tickets, deals, contracts and teams by hop">
      {RINGS.map((r) => (
        <circle key={r} cx={CENTER} cy={CENTER} r={r + (r === RINGS[1] ? 8 : 0)} fill="none" stroke="var(--hairline)" strokeDasharray="2 6" />
      ))}
      <HopWave hops={hops} />
    </svg>
  );
}

function edges_(data: RippleResult, byId: Map<string, Placed>) {
  const guarantee = new Set(data.conflicts.flatMap((c) => c.contractIds));
  return data.edges.flatMap((e, i) => {
    const a = byId.get(e.from);
    const b = byId.get(e.to);
    if (!a || !b) return [];
    const conflict = guarantee.has(e.from) || guarantee.has(e.to);
    return [{
      key: `${e.from}-${e.to}-${i}`,
      d: `M${a.x} ${a.y}L${b.x} ${b.y}`,
      hop: Math.min(Math.max(a.hop, b.hop), 3),
      conflict,
      stroke: conflict ? "var(--conflict)" : e.type === "SUNSETS" ? "var(--ripple)" : "var(--faint)",
    }];
  });
}
