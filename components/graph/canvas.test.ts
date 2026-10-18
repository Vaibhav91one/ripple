import { expect, test } from "vitest";
import type { GraphView } from "@/lib/graph/view";
import { findNode, neighbourhood, roleOf, sizeOf, toCanvas } from "./canvas";
import { buildAllView, GraphAllView } from "@/lib/graph/view";

const node = (id: string, kind: GraphView["nodes"][number]["kind"], status: GraphView["nodes"][number]["status"] = "neutral", items: GraphView["nodes"][number]["items"] = []) =>
  ({ id, kind, lane: 0, title: id.toUpperCase(), subtitle: "", status, count: items.length || 1, items, validFrom: 0 });
const edge = (from: string, to: string, status: "conflict" | "neutral" = "neutral") =>
  ({ id: `${from}|${to}`, from, to, type: "OWNS" as const, label: "OWNS", status, validFrom: 0, count: 1, sources: [] });

const ripple: GraphView = {
  decision: { id: "d-1", title: "Sunset" },
  nodes: [
    node("d-1", "decision", "conflict"), node("api", "system"), node("legal", "team", "conflict"), node("devrel", "team", "gap"), node("eng", "team", "covered"),
    node("c-customers", "customers", "neutral", [{ id: "cu-1", label: "Acme", validFrom: 0, conflict: false }, { id: "cu-2", label: "Contract", validFrom: 0, conflict: true }]),
  ],
  edges: [edge("d-1", "api", "conflict"), edge("legal", "api"), edge("devrel", "api"), edge("eng", "api"), edge("c-customers", "api")],
  lens: null, cypher: [],
};

test("status -> token role: traced path teal, not told amber, conflict red, the rest grey", () => {
  const g = toCanvas(ripple);
  const role = (k: string) => g.nodes.find((n) => n.key === k)?.role;
  expect([role("d-1"), role("api"), role("eng")]).toEqual(["ripple", "ripple", "ripple"]);
  expect(role("devrel")).toBe("gap");
  expect(role("legal")).toBe("conflict");
  expect(role("c-customers")).toBe("neutral");
  expect(role("cu-2")).toBe("conflict");
  expect(g.links.find((l) => g.nodes[l.source].key === "d-1")?.role).toBe("conflict");
  // the whole graph has no traced path: a decision is just a node there
  expect(roleOf("neutral", "system", false)).toBe("neutral");
  expect(roleOf("conflict", "decision", false)).toBe("conflict");
});

test("degree sizing: hubs are bigger, leaves are small dots, capped", () => {
  const g = toCanvas(ripple);
  const api = g.nodes.find((n) => n.key === "api")!, cu = g.nodes.find((n) => n.key === "cu-1")!;
  expect(api.degree).toBe(5);
  expect(cu.degree).toBe(1);
  expect(api.size).toBeGreaterThan(cu.size);
  expect(sizeOf(10_000)).toBe(9);
  expect(sizeOf(0)).toBe(2.5);
});

test("cluster items become dots, ids are dense numbers, links point at real nodes", () => {
  const g = toCanvas(ripple);
  expect(g.nodes.map((n) => n.id)).toEqual(g.nodes.map((_, i) => i));
  expect(g.nodes.find((n) => n.key === "c-customers")?.title).toBe("C-CUSTOMERS · 2");
  expect(g.links.every((l) => g.nodes[l.source] && g.nodes[l.target])).toBe(true);
  const api = g.nodes.find((n) => n.key === "api")!.id;
  expect(neighbourhood(g, api).size).toBe(6);
  expect(findNode(g, "acm")?.key).toBe("cu-1");
  expect(findNode(g, "  ")).toBeNull();
});

test("whole graph: redaction-safe labels, kind filter, team neighbourhood, no dangling edges", () => {
  const rows = [
    { id: "ctr-1", labels: ["Contract"], title: "SECRET MSA", conflict: true },
    { id: "api", labels: ["System"], title: "API v1", conflict: false },
    { id: "legal", labels: ["Team"], title: "Legal", conflict: false },
    { id: "cu-1", labels: ["Customer"], title: "Acme", conflict: false },
    { id: "p-1", labels: ["Person"], title: "Ana", conflict: false },
  ];
  const edges = [{ from: "ctr-1", to: "api", type: "GUARANTEES" }, { from: "legal", to: "ctr-1", type: "OWNS" }, { from: "cu-1", to: "api", type: "USES" }, { from: "p-1", to: "legal", type: "MEMBER_OF" }, { from: "api", to: "api", type: "NOPE" }];
  const v = buildAllView(rows, edges, { now: 1 });
  expect(v.nodes.map((n) => n.id)).toEqual(["ctr-1", "api", "legal", "cu-1"]); // Person is not an explorer kind
  expect(v.edges).toHaveLength(3);
  // what redact() does to a restricted graph node: title gone, label becomes the kind noun
  const redacted = { ...v, nodes: v.nodes.map((n) => (n.id === "ctr-1" ? { ...Object.fromEntries(Object.entries(n).filter(([k]) => k !== "title")), label: "Contract" } : n)) };
  const out = GraphAllView.parse(redacted);
  expect(out.nodes.find((n) => n.id === "ctr-1")?.title).toBe("Contract");
  expect(JSON.stringify(out)).not.toContain("SECRET");
  expect(buildAllView(rows, edges, { now: 1, kinds: ["contracts"] }).nodes.map((n) => n.id)).not.toContain("cu-1");
  const legal = buildAllView(rows, edges, { now: 1, team: "legal" });
  expect(legal.nodes.map((n) => n.id).sort()).toEqual(["api", "ctr-1", "legal"]); // two hops, not three (cu-1)
  expect(buildAllView(rows, edges, { now: 1, cap: 2 }).edges.every((e) => ["ctr-1", "api"].includes(e.from) && ["ctr-1", "api"].includes(e.to))).toBe(true);
});
