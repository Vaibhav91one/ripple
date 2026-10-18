// Writes the graph map (Mermaid) into README.md between the graph-map markers.
// usage: pnpm tsx scripts/graph-map.ts <graph>   (a seeded graph, e.g. after `pnpm seed`-ing a temp one; never point it at a graph you care about, it only reads)
import { readFileSync, writeFileSync } from "node:fs";
import { closeClient, graphFor, roQuery } from "../lib/graph/client";
import { LABELS } from "../lib/graph/schema";
import { inject } from "./readme-block";

export type Triple = { from: string; type: string; to: string };

/** Which box a label is drawn in. Anything the seed creates that is not listed lands in "Other". */
const GROUPS: Record<string, string[]> = {
  "People and org": ["Team", "Person", "Goal", "Task"],
  "Systems and customers": ["System", "Customer", "Incident", "Page", "DocsStats", "Software"],
  "Commercial": ["Deal", "Contract", "Clause"],
  "Decisions": ["Decision", "Conflict", "Finding", "Risk", "AccessGroup", "AccessRequest"],
  "Evidence": ["Doc", "Ticket", "Message", "PR"],
  "Compliance": ["Control", "Framework", "Vendor"],
};

/** A node carries up to two labels (`Artifact:Doc`, `Change:Decision`): draw the specific one. */
export function primaryLabel(labels: string[]): string {
  return labels.find((l) => l !== "Artifact" && l !== "Change") ?? labels[0];
}

export function buildMermaid(triples: Triple[]): string {
  const edges = [...new Map(triples.map((t) => [`${t.from}|${t.type}|${t.to}`, t])).values()]
    .sort((a, b) => (a.from + a.type + a.to).localeCompare(b.from + b.type + b.to));
  const nodes = new Set(edges.flatMap((e) => [e.from, e.to]));
  const lines = ["graph LR"];
  let i = 0;
  const placed = new Set<string>();
  for (const [group, labels] of Object.entries(GROUPS)) {
    const here = labels.filter((l) => nodes.has(l));
    if (!here.length) continue;
    lines.push(`  subgraph g${i++}["${group}"]`, ...here.map((l) => `    ${l}`), "  end");
    here.forEach((l) => placed.add(l));
  }
  const other = [...nodes].filter((l) => !placed.has(l)).sort();
  if (other.length) lines.push(`  subgraph g${i}["Other"]`, ...other.map((l) => `    ${l}`), "  end");
  for (const e of edges) lines.push(`  ${e.from} -->|${e.type}| ${e.to}`);
  return lines.join("\n");
}

export function renderMap(triples: Triple[], stats: { labels: number; types: number; nodes: number; edges: number }): string {
  const edgeTypes = new Set(triples.map((t) => t.type)).size;
  return [
    "```mermaid",
    buildMermaid(triples),
    "```",
    "",
    `Generated from the seeded graph by \`scripts/graph-map.ts\`: ${stats.labels} node labels and ${stats.types} relationship types (${stats.nodes} nodes, ${stats.edges} edges), drawn as ${triples.length} distinct (label, type, label) shapes across ${edgeTypes} types. \`Artifact\` is a second label on every Doc, Ticket, Message and PR; \`Decision\` also carries \`Change\`.`,
    "",
    "- **Temporal edges.** Every relationship carries `valid_from` and `valid_to` (epoch seconds; no `valid_to` means current) plus `observed_at`. Ended edges are kept, so \"what was true on date X\" and \"what changed\" are plain `WHERE` clauses.",
    "- **Evidence on the edge.** Extracted edges carry `src` (the artifact id) and `quote` (a verbatim substring of it). A quote that is not in the artifact is dropped at ingest.",
    "- **Absence is data.** Telling a team is an edge (`INVOLVED_IN`, `ACKED`), so a team the decision reaches with no such edge is the finding.",
    `- Index coverage: ${LABELS.length} labels have an \`id\` lookup index; \`Artifact\` also has a full-text and a 384-d vector index.`,
  ].join("\n");
}

async function main() {
  const name = process.argv[2];
  if (!name) throw new Error("usage: tsx scripts/graph-map.ts <graph>");
  const g = await graphFor(name);
  const rows = await roQuery<{ a: string[]; t: string; b: string[] }>(g, "MATCH (a)-[r]->(b) RETURN DISTINCT labels(a) AS a, type(r) AS t, labels(b) AS b");
  if (!rows.length) throw new Error(`graph ${name} is empty: seed it first`);
  const [labels] = await roQuery<{ n: number }>(g, "CALL db.labels() YIELD label RETURN count(label) AS n");
  const [types] = await roQuery<{ n: number }>(g, "CALL db.relationshipTypes() YIELD relationshipType RETURN count(relationshipType) AS n");
  const [nodes] = await roQuery<{ n: number }>(g, "MATCH (n) RETURN count(n) AS n");
  const [edges] = await roQuery<{ n: number }>(g, "MATCH ()-[r]->() RETURN count(r) AS n");
  const triples = rows
    .map((r) => ({ from: primaryLabel(r.a), type: r.t, to: primaryLabel(r.b) }))
    .filter((t) => t.from !== "SeedInfo" && t.to !== "SeedInfo");
  const body = renderMap(triples, { labels: Number(labels.n), types: Number(types.n), nodes: Number(nodes.n), edges: Number(edges.n) });
  writeFileSync("README.md", inject(readFileSync("README.md", "utf8"), "graph-map", body));
  console.log(`graph map written from ${name}: ${triples.length} shapes`);
}

if (process.argv[1]?.endsWith("scripts/graph-map.ts")) {
  main().catch((e) => { console.error(e); process.exitCode = 1; }).finally(closeClient);
}
