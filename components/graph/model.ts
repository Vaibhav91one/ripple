// Pure view model for /graph: GraphView + UI state (expanded clusters, search, time, lens) -> Flowchart nodes and edges,
// and the side-panel description of one node. No React.
import type { FlowEdge, FlowNode, FlowTone } from "@/components/kit/beautifului/flowchart";
import type { Source } from "@/lib/schemas";
import type { GraphItem, GraphNode, GraphStatus, GraphView } from "@/lib/graph/view";
import { neighboursOf } from "@/lib/graph/neighbours";
import { layoutLanes } from "./layout";

export const ITEM_CAP = 10; // items shown per expanded cluster
const SINGULAR = { customers: "customer", tickets: "ticket", deals: "deal", contracts: "contract" } as const;

export type GNode = FlowNode & { iconKey: string };
export type Flow = { nodes: GNode[]; edges: FlowEdge[] };
export type Controls = {
  expanded: string[];
  q: string;
  /** epoch seconds, end of the chosen day; null shows everything */
  at: number | null;
};

const toneOf = (s: GraphStatus): FlowTone => (s === "neutral" ? "neutral" : s);

export function toFlow(view: GraphView, c: Controls): Flow {
  const live = (ts: number) => c.at === null || ts <= c.at;
  const edges = view.edges.filter((e) => live(e.validFrom));
  const touched = new Set(edges.flatMap((e) => [e.from, e.to]));
  const nodes = view.nodes.filter((n) => n.kind === "decision" || touched.has(n.id));
  const q = c.q.trim().toLowerCase();
  const match = (...s: string[]) => !!q && s.some((x) => x.toLowerCase().includes(q));

  const itemsOf = (n: GraphNode) => n.items.filter((i) => live(i.validFrom));
  const open = nodes.filter((n) => n.items.length && c.expanded.includes(n.id));
  const shown = open.flatMap((n) => itemsOf(n).slice(0, ITEM_CAP).map((i) => ({ n, i })));

  const hits = new Set<string>();
  for (const n of nodes) if (match(n.title, n.subtitle) || itemsOf(n).some((i) => match(i.label))) hits.add(n.id);
  for (const { i } of shown) if (match(i.label)) hits.add(i.id);

  const lens = view.lens ? new Set(view.lens.nodeIds) : null;
  const lensEdges = view.lens ? new Set(view.lens.edgeIds) : null;
  const dimmed = (id: string, inLens = lens?.has(id) ?? true) => !inLens || (hits.size > 0 && !hits.has(id));

  const lanes: string[][] = [0, 1, 2].map((l) => nodes.filter((n) => n.lane === l).map((n) => n.id));
  if (shown.length) lanes.push(shown.map(({ i }) => i.id));
  lanes.push(nodes.filter((n) => n.lane === 3).map((n) => n.id));
  const pos = layoutLanes(lanes);

  const flowNodes: GNode[] = nodes.map((n) => {
    const k = itemsOf(n).length;
    const sub = n.items.length ? `${k} ${k === 1 ? SINGULAR[n.kind as keyof typeof SINGULAR] : n.kind}` : n.subtitle;
    return {
      id: n.id, iconKey: n.kind, kind: KIND_LABEL[n.kind], title: n.title, subtitle: n.items.length && c.expanded.includes(n.id) ? `${sub} · open` : sub,
      badge: n.items.length ? String(k) : n.kind === "team" ? STATUS_LABEL[n.status] : undefined,
      tone: n.kind === "decision" ? "ripple" : toneOf(n.status), w: 232, ...pos[n.id], hit: hits.has(n.id), dim: dimmed(n.id),
    };
  });
  for (const { n, i } of shown)
    flowNodes.push({
      id: i.id, iconKey: n.kind, kind: SINGULAR[n.kind as keyof typeof SINGULAR], title: i.label, tone: i.conflict ? "conflict" : "neutral",
      subtitle: i.conflict ? "Guarantees the sunset system" : undefined, w: 232, ...pos[i.id], hit: hits.has(i.id), dim: dimmed(i.id, lens?.has(n.id) ?? true),
    });

  const flowEdges: FlowEdge[] = edges.map((e) => ({
    id: e.id, from: e.from, to: e.to, label: e.label, tone: e.status === "conflict" ? "conflict" : "neutral",
    dim: lensEdges ? !lensEdges.has(e.id) : false,
  }));
  for (const { n, i } of shown)
    flowEdges.push({ id: `${n.id}>${i.id}`, from: n.id, to: i.id, dashed: true, tone: i.conflict ? "conflict" : "neutral", dim: dimmed(i.id, lens?.has(n.id) ?? true) });
  return { nodes: flowNodes, edges: flowEdges };
}

const KIND_LABEL: Record<GraphNode["kind"], string> = {
  decision: "Decision", system: "System", customers: "Evidence", tickets: "Evidence", deals: "Evidence", contracts: "Evidence", team: "Team",
};
export const STATUS_LABEL: Record<GraphStatus, string> = { conflict: "Conflict", gap: "Not told", covered: "Covered", neutral: "" };

export type Inspected = {
  title: string;
  kind: string;
  status: GraphStatus;
  props: [string, string][];
  neighbours: { id: string; title: string; type: string }[];
  sourced: { edge: string; type: string; sources: Source[] }[];
};

/** Everything the side panel shows for the node (or cluster item) with this id. */
export function inspect(view: GraphView, id: string, fmt: (ts: number) => string): Inspected | null {
  const titles = new Map(view.nodes.map((n) => [n.id, n.title]));
  const node = view.nodes.find((n) => n.id === id);
  if (node) {
    const mine = view.edges.filter((e) => e.from === id || e.to === id);
    return {
      title: node.title, kind: KIND_LABEL[node.kind], status: node.status,
      props: [
        ["Kind", node.kind], ["Lane", String(node.lane + 1)], ["Status", STATUS_LABEL[node.status] || "Neutral"],
        ...(node.items.length ? ([["Items", String(node.items.length)]] as [string, string][]) : []),
        ["First linked", fmt(node.validFrom)],
      ],
      neighbours: neighboursOf(id, mine, titles),
      sourced: mine.filter((e) => e.sources.length).map((e) => ({ edge: `${titles.get(e.from)} → ${titles.get(e.to)}`, type: e.label, sources: e.sources })),
    };
  }
  let found: { cluster: GraphNode; item: GraphItem } | null = null;
  for (const n of view.nodes) {
    const item = n.items.find((i) => i.id === id);
    if (item) found = { cluster: n, item };
  }
  if (!found) return null;
  const { cluster, item } = found;
  const out = view.edges.find((e) => e.from === cluster.id && titles.has(e.to) && view.nodes.find((n) => n.id === e.to)?.kind === "system");
  return {
    title: item.label, kind: SINGULAR[cluster.kind as keyof typeof SINGULAR], status: item.conflict ? "conflict" : "neutral",
    props: [["Kind", SINGULAR[cluster.kind as keyof typeof SINGULAR]], ["Cluster", cluster.title], ["First linked", fmt(item.validFrom)], ["Conflict", item.conflict ? "Yes" : "No"]],
    neighbours: [{ id: cluster.id, title: cluster.title, type: "IN" }],
    sourced: item.src ? [{ edge: `${item.label} → ${out ? titles.get(out.to) : "system"}`, type: out?.type ?? "EVIDENCE", sources: [item.src] }] : [],
  };
}
