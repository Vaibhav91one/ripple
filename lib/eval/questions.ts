// 15 questions about the Ledgerly demo, answered by the deterministic query wrappers (no LLM).
// Each one names the tool/query that answers it, the expected answer and the artifact ids that must come back.
import type { Graph } from "../graph/client";
import { bottleneck, ripple, search, whoKnows } from "../graph/queries";
import type { RippleResult } from "../schemas";

export const NOW = Math.floor(Date.parse("2026-10-17T09:00:00Z") / 1000);

type Ctx = {
  r: RippleResult;
  v1: Awaited<ReturnType<typeof whoKnows>>["data"];
  bn: Awaited<ReturnType<typeof bottleneck>>["data"];
  hits: { id: string }[];
};
type Got = { answer: string; ids: string[] };
export type Question = { q: string; tool: string; answer: string; sources: string[]; get: (c: Ctx) => Got };

const team = (c: Ctx, id: string) => c.r.teams.find((t) => t.teamId === id)!;
const why = (c: Ctx, id: string) => ({ answer: team(c, id).why[0].reason, ids: team(c, id).why.map((w) => w.source.artifactId) });
const cf = (c: Ctx) => c.r.conflicts[0];

export const QUESTIONS: Question[] = [
  { q: "Who knows the v1 auth flow best?", tool: "who-knows (api-v1)", answer: "p-priya", sources: ["pr-v1-1", "pr-v1-9"],
    get: (c) => ({ answer: c.v1[0].personId, ids: c.v1[0].evidence }) },
  { q: "Who has handled the most v1 tickets?", tool: "who-knows (api-v1)", answer: "p-ana", sources: ["art-tkt-1", "art-tkt-12"],
    get: (c) => { const p = [...c.v1].sort((a, b) => b.handled - a.handled)[0]; return { answer: p.personId, ids: p.evidence }; } },
  { q: "Who reviewed Priya's v1 pull requests?", tool: "who-knows (api-v1)", answer: "p-sam", sources: ["pr-v1-1", "pr-v1-6"],
    get: (c) => { const p = c.v1.find((x) => x.reviewed > 0)!; return { answer: p.personId, ids: p.evidence }; } },
  { q: "Which contracts still promise v1 past the sunset?", tool: "conflicts-detect", answer: "ctr-1, ctr-2", sources: ["art-msa-northwind", "art-msa-halden"],
    get: (c) => ({ answer: cf(c).contractIds.join(", "), ids: cf(c).sources.map((s) => s.artifactId) }) },
  { q: "Which document set the Jan 31 sunset date?", tool: "conflicts-detect", answer: "art-rfc14", sources: ["art-rfc14"],
    get: (c) => ({ answer: cf(c).sources[0].artifactId, ids: cf(c).sources.map((s) => s.artifactId) }) },
  { q: "What is the gap for the v1 sunset (teams hit but never told)?", tool: "gap", answer: "devrel, legal, security", sources: ["art-sdk-docs", "art-msa-northwind", "art-auth-design"],
    get: (c) => ({ answer: [...c.r.gap].sort().join(", "), ids: c.r.gap.flatMap((t) => team(c, t).why.map((w) => w.source.artifactId)) }) },
  { q: "Which teams does the v1 sunset ripple into?", tool: "ripple", answer: "devrel, legal, sales, security, support", sources: ["art-sdk-docs", "art-msa-northwind", "art-msg-deal-1", "art-auth-design", "art-tkt-1"],
    get: (c) => ({ answer: c.r.teams.map((t) => t.teamId).sort().join(", "), ids: c.r.teams.flatMap((t) => t.why.map((w) => w.source.artifactId)) }) },
  { q: "How much ARR is at risk from the open conflict?", tool: "ripple + conflicts-detect", answer: "180000", sources: ["art-msa-northwind", "art-msa-halden"],
    get: (c) => ({ answer: String(c.r.counts.arrAtRisk), ids: cf(c).sources.map((s) => s.artifactId) }) },
  { q: "How many open conflicts does the sunset have?", tool: "conflicts-list", answer: "1", sources: ["art-rfc14"],
    get: (c) => ({ answer: String(c.r.counts.conflicts), ids: cf(c).sources.map((s) => s.artifactId) }) },
  { q: "How many open tickets are about v1?", tool: "ripple", answer: "12", sources: ["art-tkt-1"],
    get: (c) => ({ answer: String(c.r.counts.tickets), ids: team(c, "support").why.map((w) => w.source.artifactId) }) },
  { q: "How many open deals promised v1?", tool: "ripple", answer: "3", sources: ["art-msg-deal-1"],
    get: (c) => ({ answer: String(c.r.counts.deals), ids: team(c, "sales").why.map((w) => w.source.artifactId) }) },
  { q: "Why is Security in the ripple?", tool: "ripple", answer: "owns auth-service, which depends on API v1", sources: ["art-auth-design"],
    get: (c) => why(c, "security") },
  { q: "Which team blocks the most open requests?", tool: "bottleneck", answer: "legal", sources: [],
    get: (c) => ({ answer: c.bn[0].blockerTeamId, ids: [] }) },
  { q: "Who is waiting on Legal?", tool: "bottleneck", answer: "eng, finance, product, sales", sources: [],
    get: (c) => ({ answer: c.bn[0].waitingTeamIds.join(", "), ids: [] }) },
  { q: "Which artifact mentions Northwind (full-text)?", tool: "search", answer: "art-msa-northwind", sources: ["art-msa-northwind"],
    get: (c) => ({ answer: c.hits[0].id, ids: c.hits.map((h) => h.id) }) },
];

export type EvalRow = { q: string; tool: string; answer: string; expected: string; sourcesOk: boolean; pass: boolean };

export async function evaluate(g: Graph, now = NOW): Promise<EvalRow[]> {
  const c: Ctx = {
    r: await ripple(g, "d-1", now),
    v1: (await whoKnows(g, "api-v1")).data,
    bn: (await bottleneck(g, now)).data,
    hits: (await search(g, "Northwind")).data,
  };
  return QUESTIONS.map((x) => {
    const got = x.get(c);
    const sourcesOk = x.sources.every((s) => got.ids.includes(s));
    return { q: x.q, tool: x.tool, answer: got.answer, expected: x.answer, sourcesOk, pass: got.answer === x.answer && sourcesOk };
  });
}

export function toMarkdown(rows: EvalRow[]): string {
  const cell = (s: string) => s.replaceAll("|", "\\|");
  return [
    "| # | Question | Answer | Tool | Sources ok | Pass |",
    "|---|---|---|---|---|---|",
    ...rows.map((r, i) => `| ${i + 1} | ${cell(r.q)} | ${cell(r.answer)} | ${cell(r.tool)} | ${r.sourcesOk ? "yes" : "NO"} | ${r.pass ? "PASS" : "FAIL"} |`),
    "",
    `${rows.filter((r) => r.pass).length}/${rows.length} passed`,
  ].join("\n");
}
