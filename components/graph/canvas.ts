// Pure mapper for <falkordb-canvas>: GraphView -> {nodes, links} with numeric ids, a colour role per node and a
// radius by degree. No React, no DOM: RippleGraph resolves roles to token colours at runtime.
import type { GraphStatus, GraphView } from "@/lib/graph/view";

/** Which token paints a node or link: --ripple (traced path), --gap (not told), --conflict, --faint (neutral). */
export type Role = "ripple" | "gap" | "conflict" | "neutral";
export type CNode = { id: number; key: string; title: string; kind: string; role: Role; degree: number; size: number };
export type CLink = { id: number; source: number; target: number; type: string; role: Role };
export type CanvasGraph = { nodes: CNode[]; links: CLink[] };

/** Cluster items drawn as their own dots in a ripple view (the rest stay inside the cluster count). */
export const ITEM_DOTS = 24;

export function roleOf(status: GraphStatus, kind: string, traced: boolean): Role {
  if (traced && kind === "decision") return "ripple"; // the change itself is where the traced path starts
  if (status === "conflict") return "conflict";
  if (status === "gap") return "gap";
  if (status === "covered" || (traced && (kind === "decision" || kind === "system"))) return "ripple";
  return "neutral";
}

/** Radius in world units: a leaf is a small dot, hubs grow with the square root of their degree. */
export const sizeOf = (degree: number) => Math.min(9, 2.5 + Math.sqrt(degree) * 1.1);

/**
 * `traced` is true for a decision's ripple (/api/graph?d=): its decision and systems are the traced path.
 * In a ripple view, cluster items (customers, contracts, ...) become dots hanging off their cluster.
 */
export function toCanvas(view: GraphView, opts: { traced?: boolean } = {}): CanvasGraph {
  const traced = opts.traced ?? view.decision.id !== "all";
  const num = new Map<string, number>();
  const nodes: CNode[] = [];
  const links: CLink[] = [];
  const add = (key: string, title: string, kind: string, role: Role) => {
    if (num.has(key)) return;
    num.set(key, nodes.length);
    nodes.push({ id: nodes.length, key, title, kind, role, degree: 0, size: 0 });
  };
  const link = (from: string, to: string, type: string, role: Role) => {
    const s = num.get(from), t = num.get(to);
    if (s === undefined || t === undefined || s === t) return;
    links.push({ id: links.length, source: s, target: t, type, role });
    nodes[s].degree++;
    nodes[t].degree++;
  };

  for (const n of view.nodes) add(n.id, n.items.length ? `${n.title} · ${n.count}` : n.title, n.kind, roleOf(n.status, n.kind, traced));
  for (const e of view.edges) link(e.from, e.to, e.type, e.status === "conflict" ? "conflict" : "neutral");
  for (const n of view.nodes)
    for (const i of n.items.slice(0, ITEM_DOTS)) {
      add(i.id, i.label, n.kind, i.conflict ? "conflict" : "neutral");
      link(n.id, i.id, "IN", i.conflict ? "conflict" : "neutral");
    }
  for (const n of nodes) n.size = sizeOf(n.degree);
  return { nodes, links };
}

/** The node and its direct neighbours (by numeric id), for hover and search highlight. */
export function neighbourhood(g: CanvasGraph, id: number): Set<number> {
  const out = new Set([id]);
  for (const l of g.links) {
    if (l.source === id) out.add(l.target);
    if (l.target === id) out.add(l.source);
  }
  return out;
}

/** Search: the best node for a query (exact title, then prefix, then substring), or null. */
export function findNode(g: CanvasGraph, q: string): CNode | null {
  const s = q.trim().toLowerCase();
  if (!s) return null;
  const t = (n: CNode) => n.title.toLowerCase();
  return g.nodes.find((n) => t(n) === s) ?? g.nodes.find((n) => t(n).startsWith(s)) ?? g.nodes.find((n) => t(n).includes(s)) ?? null;
}
