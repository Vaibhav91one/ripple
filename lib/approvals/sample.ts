// Read-only sample for the anonymous demo when Postgres has nothing to show. Same shapes as the live routes.
import type { ApprovalList, RunDetail, RunList } from "../schemas/approvals";
import { summarize } from "./format";

const T = Date.parse("2026-10-17T08:00:00Z");
const at = (minAgo: number) => new Date(T - minAgo * 60_000).toISOString();

const mk = (i: number, kind: string, payload: unknown, evidence: unknown, agent: string | null, minAgo: number, extra: { status?: "pending" | "failed"; error?: string } = {}) => {
  const s = summarize(kind, payload, evidence, agent);
  return {
    id: `00000000-0000-4000-8000-00000000a${String(i).padStart(3, "0")}`, kind, status: extra.status ?? "pending", ...s,
    runId: agent ? "00000000-0000-4000-8000-00000000b001" : null, groupSize: 1, requestedAt: at(minAgo), decidedAt: null, approver: null,
    error: extra.error ?? null, canDecide: false,
  };
};

const SRC = "upload:art-msa-northwind";
const edge = (type: string, from: [string, string], to: [string, string], q: string, c: number) => ({ op: "merge_edge", type, from: { label: from[0], id: from[1] }, to: { label: to[0], id: to[1] }, props: {}, src: SRC, quote: q, confidence: c, structured: false });
const ev = (q: string, c: number) => [{ src: SRC, quote: q, confidence: c }];
const rows = [
  mk(1, "graph_merge", edge("PROMISED", ["Customer", "cust-1"], ["System", "api-v1"], "Northwind may rely on API v1 until 30 June 2027.", 0.91), ev("Northwind may rely on API v1 until 30 June 2027.", 0.91), null, 14),
  mk(2, "graph_merge", edge("PROMISED", ["Customer", "cust-1"], ["System", "api-v2"], "Northwind will be offered API v2 migration support.", 0.84), ev("Northwind will be offered API v2 migration support.", 0.84), null, 14),
  mk(3, "graph_merge", edge("GUARANTEES", ["Contract", "ctr-1"], ["System", "api-v1"], "Ledgerly guarantees availability of API v1 until 2027-06-30.", 0.77), ev("Ledgerly guarantees availability of API v1 until 2027-06-30.", 0.77), null, 14),
  mk(4, "create_task", { id: "t-9001", teamId: "support", decisionId: "d-1", title: "Tell Northwind Capital about the API v1 sunset", body: "Support has not acknowledged the sunset; Northwind has an open escalation." }, [{ src: "slack:C01/1760", quote: "Northwind asked again about v1 last week." }], "brief-writer", 42),
  mk(5, "create_issue", { title: "Migrate Northwind webhooks to API v2", body: "Northwind still posts to /v1/hooks." }, [], "brief-writer", 95, { status: "failed", error: "GitHub returned 403: Resource not accessible by integration (the Ripple app has no write access to ledgerly/api)" }),
  mk(6, "graph_merge", { op: "suggest_merge", kind: "Customer", aliasNorm: "northwind capital inc", nodeId: "cust-1", mention: "Northwind Capital Inc.", score: 0.93, newId: "cust-northwind-inc", src: SRC }, [{ src: SRC, quote: "Northwind Capital Inc. (the Customer)" }], null, 130),
];
const size = new Map<string, number>();
for (const r of rows) if (r.group) size.set(`${r.kind}${r.group}`, (size.get(`${r.kind}${r.group}`) ?? 0) + 1);

export const SAMPLE_APPROVALS: ApprovalList = {
  approvals: rows.map((r) => ({ ...r, groupSize: r.group ? size.get(`${r.kind}${r.group}`) ?? 1 : 1 })),
  open: rows.length,
  sample: true,
  note: "Sample data. Sign in to review your own org's proposals.",
};

const RUN = "00000000-0000-4000-8000-00000000b001";
export const SAMPLE_RUNS: RunList = {
  sample: true,
  note: "Sample data. Sign in to see your org's runs.",
  runs: [
    { id: RUN, agent: "brief-writer", trigger: "event:change.detected", status: "done", tokens: 6240, startedAt: at(44), durationMs: 18_400, proposals: 2, error: null },
    { id: "00000000-0000-4000-8000-00000000b002", agent: "brief-writer", trigger: "cron", status: "failed", tokens: 1180, startedAt: at(600), durationMs: 4_100, proposals: 0, error: "no model configured" },
  ],
};

export const SAMPLE_RUN: RunDetail = {
  run: { ...SAMPLE_RUNS.runs[0], input: { decisionId: "d-1" }, output: { briefs: 2 } },
  steps: [
    { n: 1, kind: "tool", tool: "who_is_affected", args: { decisionId: "d-1" }, cypher: ["// affected\nMATCH (d:Decision {id: $d})-[:SUNSETS]->(s:System)<-[:RUNS_ON]-(c:Customer)\nRETURN c.id AS customer, s.id AS system LIMIT 20"], sources: ["art-msa-acme"], tokens: 1900, durationMs: 42, rowCount: 6 },
    { n: 2, kind: "tool", tool: "team_status", args: { decisionId: "d-1", team: "support" }, cypher: ["// told\nMATCH (t:Team {id: $t})<-[r:TOLD]-(d:Decision {id: $d}) RETURN count(r) AS told"], sources: [], tokens: 1400, durationMs: 18, rowCount: 1 },
    { n: 3, kind: "text", tool: null, args: null, cypher: [], sources: [], tokens: 2940, durationMs: null, rowCount: null },
  ],
  proposals: [
    { id: SAMPLE_APPROVALS.approvals[3].id, kind: "create_task", status: "pending", summary: SAMPLE_APPROVALS.approvals[3].summary, subject: null },
    { id: SAMPLE_APPROVALS.approvals[4].id, kind: "create_issue", status: "failed", summary: SAMPLE_APPROVALS.approvals[4].summary, subject: null },
  ],
};
