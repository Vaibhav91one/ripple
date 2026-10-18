import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildMermaid, primaryLabel, renderMap, type Triple } from "./graph-map";
import { mdTable, renderProof, summariseRipple } from "./graph-proof";
import { inject, median } from "./readme-block";

const readme = readFileSync("README.md", "utf8");
const triples: Triple[] = [
  { from: "Decision", type: "SUNSETS", to: "System" },
  { from: "System", type: "DEPENDS_ON", to: "System" },
  { from: "Team", type: "OWNS", to: "System" },
  { from: "Team", type: "OWNS", to: "System" }, // duplicate is drawn once
  { from: "Mystery", type: "SEES", to: "Team" }, // unlisted label lands in Other
];

describe("README markers", () => {
  it.each(["graph-map", "graph-proof"])("has %s start and end in order", (n) => {
    const a = readme.indexOf(`<!-- ${n}:start -->`);
    expect(a).toBeGreaterThan(-1);
    expect(readme.indexOf(`<!-- ${n}:end -->`)).toBeGreaterThan(a);
  });
  it("embeds a generated mermaid map and the three proofs", () => {
    expect(readme).toMatch(/<!-- graph-map:start -->\n```mermaid\ngraph LR/);
    for (const q of ["ripple", "gap", "conflicts-detect"]) expect(readme).toContain(`lib/graph/queries/${q}.cypher\`: **`);
  });
});

describe("graph map", () => {
  const m = buildMermaid(triples);
  it("is a graph LR with balanced subgraphs and only well-formed lines", () => {
    const lines = m.split("\n");
    expect(lines[0]).toBe("graph LR");
    expect(lines.filter((l) => l.includes("subgraph ")).length).toBe(lines.filter((l) => l.trim() === "end").length);
    for (const l of lines.slice(1)) expect(l).toMatch(/^ {2}(subgraph g\d+\["[^"]+"\]|end| {2}\w+|\w+ -->\|[A-Z_]+\| \w+)$/);
  });
  it("dedupes edges and groups unknown labels", () => {
    expect(m.match(/Team -->\|OWNS\| System/g)).toHaveLength(1);
    expect(m).toContain('["Other"]');
  });
  it("picks the specific label of a double-labelled node", () => {
    expect(primaryLabel(["Artifact", "Ticket"])).toBe("Ticket");
    expect(primaryLabel(["Change", "Decision"])).toBe("Decision");
  });
  it("renders the temporal and evidence notes", () => {
    const out = renderMap(triples, { labels: 5, types: 4, nodes: 9, edges: 9 });
    expect(out).toContain("```mermaid");
    expect(out).toContain("valid_from");
    expect(out).toContain("`quote`");
  });
});

describe("graph proof", () => {
  it("summarises ripple rows per branch", () => {
    const rows = [{ kind: "ticket", label: "a" }, { kind: "ticket", label: "b" }, { kind: "team", label: "x", team: "legal" }];
    expect(summariseRipple(rows)).toEqual([["ticket", "2", "a; b"], ["team", "1", "legal"]]);
  });
  it("renders a table, a collapsed query and the measured latency", () => {
    expect(mdTable(["a", "b"], [["1", "2"]])).toBe("| a | b |\n|---|---|\n| 1 | 2 |");
    const out = renderProof(
      [{ name: "gap", title: "gap", cypher: "MATCH (n) RETURN n", rows: [{}], ms: 1.234, runs: [1, 2, 1.234, 1, 1], table: [["t"], ["x"]] }],
      "d-1", "2026-10-17",
    );
    expect(out).toContain("<details><summary>Cypher</summary>");
    expect(out).toContain("**1 rows, 1.2 ms**");
  });
  it("median and inject", () => {
    expect(median([5, 1, 3, 2, 4])).toBe(3);
    const doc = inject("a\n<!-- x:start -->\nold\n<!-- x:end -->\nb", "x", "new");
    expect(doc).toBe("a\n<!-- x:start -->\nnew\n<!-- x:end -->\nb");
    expect(inject(doc, "x", "new")).toBe(doc); // idempotent
    expect(() => inject("none", "x", "y")).toThrow(/markers/);
  });
});
