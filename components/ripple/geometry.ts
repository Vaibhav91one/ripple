import type { RippleResult } from "@/lib/schemas";

type N = RippleResult["nodes"][number];
export type Placed = N & { x: number; y: number; r: number };

export const SIZE = 760;
export const CENTER = SIZE / 2;
export const RINGS = [100, 225, 330]; // radius of hop 1, 2, 3
const KIND_ORDER = ["customer", "ticket", "deal", "contract"] as const;
const R = { 0: 26, 1: 20, 2: 6, 3: 15 } as const;

const at = (radius: number, deg: number) => ({
  x: CENTER + radius * Math.cos(((deg - 90) * Math.PI) / 180),
  y: CENTER + radius * Math.sin(((deg - 90) * Math.PI) / 180),
});

/** Hop = ring; hop-2 nodes sit in sectors grouped by kind; teams spread evenly on ring 3. */
export function place(nodes: N[]): Placed[] {
  const out: Placed[] = [];
  const put = (n: N, radius: number, deg: number, r: number) => out.push({ ...n, ...at(radius, deg), r });
  const hop2 = KIND_ORDER.map((k) => nodes.filter((n) => n.hop === 2 && n.kind === k));
  const weights = hop2.map((g) => (g.length ? Math.max(g.length, 6) : 0));
  const total = weights.reduce((a, b) => a + b, 0) || 1;
  let start = 0;
  hop2.forEach((g, gi) => {
    const span = (weights[gi] / total) * 360;
    g.forEach((n, i) => put(n, RINGS[1] + (i % 2) * 16, start + ((i + 0.5) / g.length) * span, R[2]));
    start += span;
  });
  nodes.filter((n) => n.hop === 0).forEach((n) => put(n, 0, 0, R[0]));
  nodes.filter((n) => n.hop === 1).forEach((n, i, a) => put(n, RINGS[0], (i / a.length) * 360 + 180, R[1]));
  nodes.filter((n) => n.hop >= 3).forEach((n, i, a) => put(n, RINGS[2], 18 + (i / a.length) * 360, R[3]));
  return out;
}
