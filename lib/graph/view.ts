// The /graph flowchart view: Zod schema, the pure builder (RippleResult + edge evidence -> lanes) and the team lens.
// Client-safe: no FalkorDB import. Query orchestration lives in graph-view.ts.
import { z } from "zod";
import { EdgeType, Source, type RippleResult } from "../schemas";
import { restrictedField } from "../schemas/common";

const id = z.string().min(1);
const ts = z.number().int();

export const EvidenceKind = z.enum(["customers", "tickets", "deals", "contracts"]);
export type EvidenceKind = z.infer<typeof EvidenceKind>;
export const GraphNodeKind = z.enum(["decision", "system", ...EvidenceKind.options, "team"]);
export const GraphStatus = z.enum(["conflict", "gap", "covered", "neutral"]);
export type GraphStatus = z.infer<typeof GraphStatus>;

export const GraphItem = z.object({
  id,
  label: z.string(),
  validFrom: ts,
  conflict: z.boolean(),
  src: Source.optional(),
});
export const GraphNode = z.object({
  id,
  kind: GraphNodeKind,
  /** 0 decision, 1 systems, 2 evidence clusters, 3 teams */
  lane: z.number().int().min(0).max(3),
  title: z.string(),
  subtitle: z.string(),
  status: GraphStatus,
  count: z.number().int(),
  items: z.array(GraphItem),
  /** earliest incident edge: the time-scrubber hides nodes whose edges are all newer than its date */
  validFrom: ts,
});
export const GraphEdge = z.object({
  id,
  from: id,
  to: id,
  type: EdgeType,
  label: z.string(),
  status: z.enum(["conflict", "neutral"]),
  validFrom: ts,
  count: z.number().int(),
  sources: z.array(Source),
});
export const GraphView = z.object({
  decision: z.object({ id, title: z.string() }),
  nodes: z.array(GraphNode),
  edges: z.array(GraphEdge),
  /** set when ?team= names a team in the view: the nodes and edges on its paths back to the decision */
  lens: z.object({ teamId: id, nodeIds: z.array(id), edgeIds: z.array(id) }).nullable(),
  cypher: z.array(z.object({ name: z.string(), text: z.string() })),
  ...restrictedField,
});
export type GraphItem = z.infer<typeof GraphItem>;
export type GraphNode = z.infer<typeof GraphNode>;
export type GraphEdge = z.infer<typeof GraphEdge>;
export type GraphView = z.infer<typeof GraphView>;

export type EdgeMeta = { from: string; to: string; type: string; validFrom: number | null; src: string | null; quote: string | null };

const CLUSTER = { customer: "customers", ticket: "tickets", deal: "deals", contract: "contracts" } as const;
const NOUN = { customers: "customer", tickets: "open ticket", deals: "open deal", contracts: "contract" } as const;
const ENTITY_TO_SYSTEM = new Set(["ABOUT", "PROMISED", "GUARANTEES", "USES"]);
const uniq = <T>(xs: T[], key: (x: T) => string) => [...new Map(xs.map((x) => [key(x), x])).values()];

export function buildGraphView(r: RippleResult, meta: EdgeMeta[], opts: { team?: string | null; kinds?: EvidenceKind[] } = {}): GraphView {
  const kinds = new Set<EvidenceKind>(opts.kinds?.length ? opts.kinds : EvidenceKind.options);
  const metaOf = new Map(meta.map((m) => [`${m.from}|${m.to}|${m.type}`, m]));
  const entityMeta = new Map<string, EdgeMeta>();
  for (const m of meta) if (ENTITY_TO_SYSTEM.has(m.type) && !entityMeta.has(m.from)) entityMeta.set(m.from, m);
  const src = (m?: EdgeMeta): Source[] => (m?.src && m.quote ? [{ artifactId: m.src, quote: m.quote }] : []);
  const conflictIds = new Set(r.conflicts.flatMap((c) => c.contractIds));
  const kindOf = new Map(r.nodes.map((n) => [n.id, n.kind]));
  const at = (m?: EdgeMeta) => m?.validFrom ?? r.decision.decidedAt;
  const clusterOf = (nodeId: string) => {
    const k = kindOf.get(nodeId);
    return k && k in CLUSTER ? CLUSTER[k as keyof typeof CLUSTER] : null;
  };

  const nodes: GraphNode[] = [
    { id: r.decision.id, kind: "decision", lane: 0, title: r.decision.title, subtitle: `Decision · ${r.decision.status}`, status: r.conflicts.length ? "conflict" : "neutral", count: 1, items: [], validFrom: r.decision.decidedAt },
  ];
  for (const n of r.nodes.filter((x) => x.kind === "system"))
    nodes.push({ id: n.id, kind: "system", lane: 1, title: n.label, subtitle: n.hop === 1 ? "Sunset target" : "Depends on it", status: "neutral", count: 1, items: [], validFrom: r.decision.decidedAt });
  for (const k of EvidenceKind.options) {
    if (!kinds.has(k)) continue;
    const items = r.nodes
      .filter((n) => clusterOf(n.id) === k)
      .map((n): GraphItem => {
        const m = entityMeta.get(n.id);
        return { id: n.id, label: n.label, validFrom: at(m), conflict: conflictIds.has(n.id), ...(src(m)[0] ? { src: src(m)[0] } : {}) };
      });
    if (!items.length) continue;
    nodes.push({
      id: `c-${k}`, kind: k, lane: 2, title: k[0].toUpperCase() + k.slice(1),
      subtitle: `${items.length} ${NOUN[k]}${items.length === 1 ? "" : "s"}`,
      status: items.some((i) => i.conflict) ? "conflict" : "neutral", count: items.length, items,
      validFrom: Math.min(...items.map((i) => i.validFrom)),
    });
  }

  // edges: entity -> X collapses to cluster -> X, with the entities' sources and the earliest date
  const edges = new Map<string, GraphEdge>();
  const teamIds = new Set(r.teams.map((t) => t.teamId));
  for (const e of r.edges) {
    const k = clusterOf(e.from);
    const from = k ? `c-${k}` : e.from;
    const m = k ? entityMeta.get(e.from) : metaOf.get(`${e.from}|${e.to}|${e.type}`);
    const key = `${from}|${e.to}|${e.type}`;
    const g: GraphEdge = edges.get(key) ?? { id: key, from, to: e.to, type: e.type, label: e.type, status: "neutral", validFrom: at(m), count: 0, sources: [] };
    g.count += 1;
    g.validFrom = Math.min(g.validFrom, at(m));
    g.sources = uniq([...g.sources, ...src(m)], (s) => s.artifactId + s.quote).slice(0, 4);
    edges.set(key, g);
  }

  const badContracts = (n: GraphNode) => n.kind === "contracts" && n.status === "conflict";
  const conflictTeams = new Set(
    [...edges.values()].filter((e) => e.from === "c-contracts" && teamIds.has(e.to) && nodes.some((n) => n.id === e.from && badContracts(n))).map((e) => e.to),
  );
  const names = new Map(r.nodes.map((n) => [n.id, n.label]));
  for (const t of r.teams)
    nodes.push({
      id: t.teamId, kind: "team", lane: 3, title: names.get(t.teamId) ?? t.teamId, subtitle: t.why[0]?.reason ?? "",
      status: conflictTeams.has(t.teamId) ? "conflict" : r.gap.includes(t.teamId) ? "gap" : "covered",
      count: 1, items: [], validFrom: r.decision.decidedAt,
    });

  const byId = new Map(nodes.map((n) => [n.id, n]));
  const kept = [...edges.values()].filter((e) => byId.has(e.from) && byId.has(e.to));
  for (const e of kept) {
    const a = byId.get(e.from)!, b = byId.get(e.to)!;
    e.label = e.count > 1 ? `${e.type} ×${e.count}` : e.type;
    // conflict path: decision -> sunset target -> contracts -> the team managing them
    if ((a.kind === "decision" && b.kind === "system" && r.conflicts.length) || (badContracts(a) && (b.kind !== "team" || b.status === "conflict")))
      e.status = "conflict";
  }
  for (const n of nodes) {
    const mine = kept.filter((e) => e.from === n.id || e.to === n.id).map((e) => e.validFrom);
    if (n.kind !== "decision" && mine.length) n.validFrom = Math.min(...mine);
  }

  const view: GraphView = { decision: { id: r.decision.id, title: r.decision.title }, nodes, edges: kept, lens: null, cypher: r.cypher };
  if (opts.team && byId.get(opts.team)?.kind === "team") view.lens = lensFor(view, opts.team);
  return view;
}

/** Nodes and edges on the paths from `teamId` back to the decision (stepping to lower lanes, or along DEPENDS_ON). */
export function lensFor(view: Pick<GraphView, "nodes" | "edges">, teamId: string): NonNullable<GraphView["lens"]> {
  const lane = new Map(view.nodes.map((n) => [n.id, n.lane]));
  const seen = new Set([teamId]);
  const used = new Set<string>();
  const queue = [teamId];
  for (let cur = queue.shift(); cur; cur = queue.shift()) {
    for (const e of view.edges) {
      const other = e.from === cur ? e.to : e.to === cur ? e.from : null;
      if (!other) continue;
      const down = lane.get(other)! < lane.get(cur)!;
      const along = lane.get(other) === lane.get(cur) && e.type === "DEPENDS_ON" && e.from === cur;
      if (!down && !along) continue;
      used.add(e.id);
      if (!seen.has(other)) {
        seen.add(other);
        queue.push(other);
      }
    }
  }
  return { teamId, nodeIds: [...seen], edgeIds: [...used] };
}

// ---------- the whole graph (/api/graph/all) ----------

export type AllRow = { id: string; labels: string[]; title: string; conflict: boolean };
export type AllEdge = { from: string; to: string; type: string };

const LABEL_KIND: Record<string, { kind: GraphNode["kind"]; lane: number; noun: string }> = {
  Decision: { kind: "decision", lane: 0, noun: "Decision" },
  System: { kind: "system", lane: 1, noun: "System" },
  Customer: { kind: "customers", lane: 2, noun: "Customer" },
  Ticket: { kind: "tickets", lane: 2, noun: "Ticket" },
  Deal: { kind: "deals", lane: 2, noun: "Deal" },
  Contract: { kind: "contracts", lane: 2, noun: "Contract" },
  Team: { kind: "team", lane: 3, noun: "Team" },
};

/**
 * Rows from graph-all(-edges).cypher -> a GraphView of the whole company graph. Every node also carries `label`
 * (= title) so redact() treats it as a graph node: a restricted node keeps its id and edges, its name becomes the
 * kind noun. GraphAllView restores `title` from that label after redaction.
 */
export function buildAllView(
  rows: AllRow[],
  edgeRows: AllEdge[],
  opts: { team?: string | null; kinds?: EvidenceKind[]; cap?: number; now: number },
): GraphView {
  const kinds = new Set<string>(opts.kinds?.length ? opts.kinds : EvidenceKind.options);
  let nodes = rows.flatMap((r) => {
    const k = r.labels.map((l) => LABEL_KIND[l]).find(Boolean);
    if (!k || (k.lane === 2 && !kinds.has(k.kind))) return [];
    const n: GraphNode & { label: string } = {
      id: r.id, kind: k.kind, lane: k.lane, title: r.title, label: r.title, subtitle: k.noun,
      status: r.conflict ? "conflict" : "neutral", count: 1, items: [], validFrom: opts.now,
    };
    return [n];
  });
  const ids = () => new Set(nodes.map((n) => n.id));
  let has = ids();
  let edges: GraphEdge[] = edgeRows.flatMap((e, i) => {
    const type = EdgeType.safeParse(e.type);
    if (!type.success || !has.has(e.from) || !has.has(e.to) || e.from === e.to) return [];
    return [{ id: `${e.from}|${e.to}|${e.type}|${i}`, from: e.from, to: e.to, type: type.data, label: e.type, status: "neutral" as const, validFrom: opts.now, count: 1, sources: [] }];
  });
  if (opts.team && has.has(opts.team)) {
    // the team and everything within two hops of it, either direction
    const keep = new Set([opts.team]);
    for (let hop = 0; hop < 2; hop++) {
      const was = new Set(keep);
      for (const e of edges) if (was.has(e.from) || was.has(e.to)) [e.from, e.to].forEach((x) => keep.add(x));
    }
    nodes = nodes.filter((n) => keep.has(n.id));
  }
  nodes = nodes.slice(0, opts.cap ?? 600);
  has = ids();
  edges = edges.filter((e) => has.has(e.from) && has.has(e.to));
  for (const e of edges) {
    const a = nodes.find((n) => n.id === e.from)!, b = nodes.find((n) => n.id === e.to)!;
    if (a.status === "conflict" && b.status === "conflict") e.status = "conflict";
  }
  return { decision: { id: "all", title: "The company graph" }, nodes, edges, lens: null, cypher: [] };
}

/** GraphView after redaction: a redacted node lost `title` but kept `label` (the kind noun); put it back. */
export const GraphAllView = z.preprocess((v) => {
  if (!v || typeof v !== "object" || !Array.isArray((v as { nodes?: unknown }).nodes)) return v;
  const o = v as { nodes: Record<string, unknown>[] };
  return { ...o, nodes: o.nodes.map((n) => ({ ...n, title: typeof n.label === "string" ? n.label : n.title })) };
}, GraphView);
