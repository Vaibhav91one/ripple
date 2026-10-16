import type { RippleResult } from "@/lib/schemas";

export const SIZE = 760;
export const CENTER = SIZE / 2;
export const RINGS = [100, 225, 330]; // radius of hop 1, 2, 3

export type LNode = {
  id: string;
  label: string;
  kind: string;
  hop: number;
  x: number;
  y: number;
  r: number;
  count?: number;
  /** tooltip: the individual items inside a cluster */
  items?: string[];
};
export type LEdge = { key: string; from: LNode; to: LNode; hop: number; dashed?: boolean; conflict?: boolean };

const KINDS = ["customer", "ticket", "deal", "contract"] as const;
const PLURAL = { customer: "customers", ticket: "tickets", deal: "deals", contract: "contracts" } as const;
// angle in degrees clockwise from top: cluster sectors on ring 2, then owner team + the rest on ring 3
const CLUSTER_DEG = { customer: 40, ticket: 85, deal: 130, contract: 300 } as const;
const OWNER = { customer: "support", ticket: "support", deal: "sales", contract: "legal" } as const;
const TEAM_DEG: Record<string, number> = { support: 62, sales: 130, legal: 300, security: 340, devrel: 20 };

const at = (radius: number, deg: number) => ({
  x: CENTER + radius * Math.sin((deg * Math.PI) / 180),
  y: CENTER - radius * Math.cos((deg * Math.PI) / 180),
});

/** Decision at the centre, API v1 on ring 1, one cluster per kind on ring 2, teams on ring 3. */
export function layout(data: RippleResult): { nodes: LNode[]; edges: LEdge[] } {
  const nodes: LNode[] = [];
  const byId = new Map<string, LNode>();
  const add = (n: LNode) => (nodes.push(n), byId.set(n.id, n), n);

  const decision = add({ ...data.nodes.find((n) => n.hop === 0)!, ...at(0, 0), r: 26 });
  const system = add({ ...data.nodes.find((n) => n.kind === "system")!, ...at(RINGS[0], 0), r: 20 });
  const clusters = KINDS.flatMap((kind) => {
    const items = data.nodes.filter((n) => n.hop === 2 && n.kind === kind);
    if (!items.length) return [];
    const r = 22 + Math.min(16, Math.sqrt(items.length) * 2.6);
    return [add({ id: `cluster-${kind}`, label: `${items.length} ${PLURAL[kind]}`, kind: `cluster-${kind}`, hop: 2, ...at(RINGS[1], CLUSTER_DEG[kind]), r, count: items.length, items: items.map((i) => i.label) })];
  });
  data.nodes.filter((n) => n.kind === "team").forEach((n, i) => add({ ...n, ...at(RINGS[2], TEAM_DEG[n.id] ?? 280 + i * 20), r: 15 }));

  const edges: LEdge[] = [];
  const link = (a: LNode | undefined, b: LNode | undefined, o: Partial<LEdge> = {}) =>
    a && b && edges.push({ key: `${a.id}-${b.id}`, from: a, to: b, hop: Math.min(Math.max(a.hop, b.hop), 3), ...o });
  link(decision, system);
  const owned = new Set<string>();
  for (const c of clusters) {
    const kind = c.kind.replace("cluster-", "") as (typeof KINDS)[number];
    link(system, c);
    link(c, byId.get(OWNER[kind]), { conflict: kind === "contract" });
    owned.add(OWNER[kind]);
  }
  nodes.filter((n) => n.kind === "team" && !owned.has(n.id)).forEach((t) => link(system, t, { dashed: true }));
  return { nodes, edges };
}
