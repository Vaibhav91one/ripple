// Pure side-panel model for the graph views: the description of one node (or cluster item) in a GraphView. No React.
import type { Source } from "@/lib/schemas";
import type { GraphItem, GraphNode, GraphStatus, GraphView } from "@/lib/graph/view";
import { neighboursOf } from "@/lib/graph/neighbours";

const SINGULAR = { customers: "customer", tickets: "ticket", deals: "deal", contracts: "contract" } as const;

const KIND_LABEL: Record<GraphNode["kind"], string> = {
  decision: "Decision", system: "System", customers: "Evidence", tickets: "Evidence", deals: "Evidence", contracts: "Evidence", team: "Team",
};
export const STATUS_LABEL: Record<GraphStatus, string> = { conflict: "Conflict", gap: "Not told", covered: "Covered", neutral: "" };

export type Inspected = {
  title: string;
  kind: string;
  /** the node's full item page, when it is a real graph node (not a cluster) */
  href?: string;
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
      href: ["decision", "system", "team"].includes(node.kind) ? `/items/${node.kind}/${id}` : undefined,
      props: [
        ["Kind", node.kind], ["Status", STATUS_LABEL[node.status] || "Neutral"],
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
    title: item.label, kind: SINGULAR[cluster.kind as keyof typeof SINGULAR], href: `/items/${SINGULAR[cluster.kind as keyof typeof SINGULAR]}/${item.id}`, status: item.conflict ? "conflict" : "neutral",
    props: [["Kind", SINGULAR[cluster.kind as keyof typeof SINGULAR]], ["Cluster", cluster.title], ["First linked", fmt(item.validFrom)], ["Conflict", item.conflict ? "Yes" : "No"]],
    neighbours: [{ id: cluster.id, title: cluster.title, type: "IN" }],
    sourced: item.src ? [{ edge: `${item.label} → ${out ? titles.get(out.to) : "system"}`, type: out?.type ?? "EVIDENCE", sources: [item.src] }] : [],
  };
}
