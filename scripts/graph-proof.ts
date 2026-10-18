// Runs the real ripple, gap and conflict-detect Cypher on a seeded graph and writes query + real output + timing into README.md
// between the graph-proof markers. usage: tsx scripts/graph-proof.ts <graph> [decision-id]   (reads only; RO_QUERY)
import { readFileSync, writeFileSync } from "node:fs";
import { closeClient, graphFor, roQuery } from "../lib/graph/client";
import { load } from "../lib/graph/queries";
import { NOW } from "../lib/mock/ledgerly-v2";
import { inject, median } from "./readme-block";

type Row = Record<string, unknown>;
export type Proof = { name: string; title: string; cypher: string; rows: Row[]; ms: number; runs: number[]; table: string[][] };

const cell = (v: unknown, max = 60): string => {
  const s = (typeof v === "object" && v !== null ? JSON.stringify(v) : String(v ?? "")).replace(/\s+/g, " ").replace(/\|/g, "\\|");
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
};

export function mdTable(head: string[], rows: string[][]): string {
  return [`| ${head.join(" | ")} |`, `|${head.map(() => "---").join("|")}|`, ...rows.map((r) => `| ${r.join(" | ")} |`)].join("\n");
}

/** One row per branch of the ripple's UNION ALL: how many rows it returned and two examples. */
export function summariseRipple(rows: Row[]): string[][] {
  const by = new Map<string, Row[]>();
  for (const r of rows) by.set(`${r.kind}`, [...(by.get(`${r.kind}`) ?? []), r]);
  const name = (r: Row) => (r.kind === "team" ? r.team : r.label);
  return [...by].map(([kind, rs]) => {
    const distinct = [...new Set(rs.map(name))];
    return [kind, `${rs.length}`, cell(`${distinct.slice(0, 3).join("; ")}${distinct.length > 3 ? ` (+${distinct.length - 3} more)` : ""}`, 80)];
  });
}

export function renderProof(proofs: Proof[], decision: string, nowIso: string): string {
  const out = [
    `Measured on a freshly seeded graph for decision \`${decision}\` ("Sunset API v1"), \`GRAPH.RO_QUERY\` from a Node client to FalkorDB 6.0.2 on the same machine, one warm-up then the median of 5 runs (round trip including the client). Regenerate with \`pnpm graph:readme\`. Temporal filters evaluate at \`$now = ${nowIso}\`.`,
    "",
  ];
  for (const p of proofs) {
    out.push(
      `#### ${p.title}`,
      "",
      `\`lib/graph/queries/${p.name}.cypher\`: **${p.rows.length} rows, ${p.ms.toFixed(1)} ms** (runs: ${p.runs.map((x) => x.toFixed(1)).join(", ")} ms)`,
      "",
      mdTable(p.table[0], p.table.slice(1)),
      "",
      "<details><summary>Cypher</summary>",
      "",
      "```cypher",
      p.cypher.trim(),
      "```",
      "",
      "</details>",
      "",
    );
  }
  return out.join("\n").trimEnd();
}

async function timed(run: () => Promise<Row[]>): Promise<{ rows: Row[]; ms: number; runs: number[] }> {
  let rows = await run(); // warm-up: query cache and connection
  const runs: number[] = [];
  for (let i = 0; i < 5; i++) {
    const t = performance.now();
    rows = await run();
    runs.push(performance.now() - t);
  }
  return { rows, ms: median(runs), runs };
}

async function main() {
  const [name, decision = "d-1"] = process.argv.slice(2);
  if (!name) throw new Error("usage: tsx scripts/graph-proof.ts <graph> [decision-id]");
  const g = await graphFor(name);
  const ripple = load("ripple");
  const gap = load("gap");
  const det = load("conflicts-detect");

  const rp = await timed(() => roQuery(g, ripple.text, { id: decision, now: NOW }));
  if (!rp.rows.length) throw new Error(`ripple returned no rows for ${decision} on ${name}: is the graph seeded?`);
  const affected = [...new Set(rp.rows.filter((r) => r.kind === "team").map((r) => String(r.team)))];
  const gp = await timed(() => roQuery(g, gap.text, { id: decision, affected }));
  const cf = await timed(() => roQuery(g, det.text, { id: decision }));

  const branches = ripple.text.split("UNION ALL").length;
  const proofs: Proof[] = [
    { name: "ripple", title: "1. The ripple: what does the decision touch?", cypher: ripple.text, ...rp, table: [["branch (kind)", "rows", "examples"], ...summariseRipple(rp.rows)] },
    {
      name: "gap", title: "2. The gap: which affected teams were never told?", cypher: gap.text, ...gp,
      table: [["team", "involved", "acked", "verdict"], ...gp.rows.map((r) => [cell(r.team), cell(r.involved), cell(r.acked), r.involved || r.acked ? "told" : "**never told**"])],
    },
    {
      name: "conflicts-detect", title: "3. The conflict: a contract guarantees what the decision sunsets", cypher: det.text, ...cf,
      table: [["system", "contracts", "sunset source", "sunset quote"], ...cf.rows.map((r) => [cell(r.systemId), cell(r.contractIds), cell(r.sunsetSrc), cell(r.sunsetQuote, 70)])],
    },
  ];
  const why = [
    "",
    `**Why this is a graph problem.** The ripple is one statement of ${branches} \`UNION ALL\` branches, and every branch starts the same way: from the decision follow \`SUNSETS\` to a system, then \`DEPENDS_ON*0..2\` backwards through the dependency chain (up to three systems deep, \`depth\` raises the bound), keeping only edges whose \`valid_to\` is null. From each system reached it takes one more hop to the tickets (\`ABOUT\`), deals (\`PROMISED\`), contracts (\`GUARANTEES\` then \`PARTY_TO\` the customer), customers (\`USES\`) and teams (\`OWNS\`, \`CARES_ABOUT\`, \`HANDLED_BY\`, \`OWNED_BY\`, \`MANAGED_BY\`). In SQL that is a recursive CTE for the dependency walk, then a join per entity table and per ownership table, with the temporal predicate repeated on each join: a dozen branches of several joins each, and the whole shape changes whenever you add one more relationship type. The gap query goes the other way: it is an \`OPTIONAL MATCH\` for an edge that is not there, so the answer is an absence, which in SQL is a \`LEFT JOIN ... IS NULL\` per signal. The conflict query is a three-node pattern (decision, system, contract) with a comparison across two different edges (\`g.until > s.on\`). The temporal filter is not a feature bolted on: it is a property on the same edge the traversal already visits.`,
  ].join("\n");
  const nowIso = new Date(NOW * 1000).toISOString().slice(0, 10);
  writeFileSync("README.md", inject(readFileSync("README.md", "utf8"), "graph-proof", `${renderProof(proofs, decision, nowIso)}\n${why}`));
  console.log(proofs.map((p) => `${p.name}: ${p.rows.length} rows, ${p.ms.toFixed(1)} ms`).join("\n"));
}

if (process.argv[1]?.endsWith("scripts/graph-proof.ts")) {
  main().catch((e) => { console.error(e); process.exitCode = 1; }).finally(closeClient);
}
