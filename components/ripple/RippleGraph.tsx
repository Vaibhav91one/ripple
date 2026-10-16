"use client";

import { useMemo } from "react";
import { HopEdge, HopNode, HopWave } from "@/components/motion/HopWave";
import type { RippleResult } from "@/lib/schemas";
import { CENTER, layout, RINGS, SIZE, type LNode } from "./geometry";

function style(n: LNode, r: RippleResult) {
  if (n.kind === "decision") return { fill: "var(--ripple-soft)", stroke: "var(--ripple)" };
  if (n.kind === "system") return { fill: "var(--raised)", stroke: "var(--ripple)" };
  if (n.kind === "cluster-contract") return { fill: "var(--conflict-soft)", stroke: "var(--conflict)" };
  if (n.kind === "team") {
    const hasConflict = r.teams.some((t) => t.teamId === n.id && t.why.some((w) => r.conflicts.some((c) => c.contractIds.includes(w.ref))));
    if (r.gap.includes(n.id)) return { fill: "var(--gap-soft)", stroke: hasConflict ? "var(--conflict)" : "var(--gap)" };
    return { fill: "var(--covered-soft)", stroke: "var(--covered)" };
  }
  return { fill: "var(--raised)", stroke: "var(--faint)" };
}

export function RippleGraph({ data }: { data: RippleResult }) {
  const { nodes, edges } = useMemo(() => layout(data), [data]);

  const hops = [0, 1, 2, 3].map((h) => [
    ...edges.filter((e) => e.hop === h).map((e) => (
      <HopEdge
        key={e.key}
        d={`M${e.from.x} ${e.from.y}L${e.to.x} ${e.to.y}`}
        fill="none"
        stroke={e.conflict ? "var(--conflict)" : e.from.kind === "decision" ? "var(--ripple)" : "var(--faint)"}
        strokeWidth={e.conflict ? 1.5 : 1}
        strokeDasharray={e.dashed ? "4 4" : undefined}
        opacity={e.conflict ? 0.9 : 0.5}
      />
    )),
    ...nodes.filter((n) => n.hop === h).map((n) => {
      const s = style(n, data);
      return (
        <HopNode key={n.id}>
          <circle cx={n.x} cy={n.y} r={n.r} fill={s.fill} stroke={s.stroke} strokeWidth={n.r > 10 ? 1.75 : 1.25} />
          {n.items && <title>{n.items.slice(0, 12).join("\n") + (n.items.length > 12 ? `\n+${n.items.length - 12} more` : "")}</title>}
          {n.count !== undefined ? (
            <>
              <text x={n.x} y={n.y + 5} textAnchor="middle" fontSize={15} fontWeight={600} fill="var(--strong)">{n.count}</text>
              <text x={n.x} y={n.y + n.r + 14} textAnchor="middle" fontSize={12} fill="var(--body)">{n.label.replace(/^\d+ /, "")}</text>
            </>
          ) : (
            <text x={n.x + (n.hop === 0 ? n.r + 8 : 0)} y={n.hop === 0 ? n.y + 4 : n.y + n.r + 14} textAnchor={n.hop === 0 ? "start" : "middle"} fontSize={12} fill="var(--body)">
              {n.hop === 0 ? "Sunset API v1" : n.label}
            </text>
          )}
        </HopNode>
      );
    }),
  ]);

  return (
    <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="h-full w-full" role="img" aria-label="Ripple graph: decision, system, customer, ticket, deal and contract clusters, and teams by hop">
      {RINGS.map((r) => (
        <circle key={r} cx={CENTER} cy={CENTER} r={r} fill="none" stroke="var(--hairline)" strokeDasharray="2 6" />
      ))}
      <HopWave hops={hops} />
    </svg>
  );
}
