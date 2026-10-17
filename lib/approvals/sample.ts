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

const edge = (to: string, q: string, c: number) => ({ op: "merge_edge", type: "PROMISED", from: { label: "Customer", id: "cust-acme" }, to: { label: "System", id: to }, props: {}, src: "upload:msa-acme.pdf", quote: q, confidence: c, structured: false });
const rows = [
  mk(1, "graph_merge", edge("api-v1", "Acme may rely on API v1 until 31 March 2027.", 0.91), [{ src: "upload:msa-acme.pdf", quote: "Acme may rely on API v1 until 31 March 2027.", confidence: 0.91 }], null, 14),
  mk(2, "graph_merge", edge("billing", "Invoices continue through the legacy billing service.", 0.84), [{ src: "upload:msa-acme.pdf", quote: "Invoices continue through the legacy billing service.", confidence: 0.84 }], null, 14),
  mk(3, "graph_merge", edge("sso", "SSO is covered by the same service level.", 0.77), [{ src: "upload:msa-acme.pdf", quote: "SSO is covered by the same service level.", confidence: 0.77 }], null, 14),
  mk(4, "create_task", { id: "t-9001", teamId: "support", decisionId: "d-1", title: "Tell Acme about the API v1 sunset", body: "Support has not acknowledged the sunset; Acme has an open escalation." }, [{ src: "slack:C01/1760", quote: "Acme asked again about v1 last week." }], "brief-writer", 42),
  mk(5, "create_issue", { title: "Migrate Acme webhooks to API v2", body: "Acme still posts to /v1/hooks." }, [], "brief-writer", 95, { status: "failed", error: "GitHub App is not installed" }),
  mk(6, "graph_merge", { op: "suggest_merge", kind: "Customer", aliasNorm: "acme inc", nodeId: "cust-acme", mention: "Acme Inc.", score: 0.93, newId: "cust-acme-inc", src: "upload:msa-acme.pdf" }, [{ src: "upload:msa-acme.pdf", quote: "Acme Inc. (the Customer)" }], null, 130),
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
    { n: 1, kind: "tool", tool: "who_is_affected", args: { decisionId: "d-1" }, cypher: ["// affected\nMATCH (d:Decision {id: $d})-[:SUNSETS]->(s:System)<-[:RUNS_ON]-(c:Customer)\nRETURN c.id AS customer, s.id AS system LIMIT 20"], sources: ["art-msa-acme"], tokens: 1900 },
    { n: 2, kind: "tool", tool: "team_status", args: { decisionId: "d-1", team: "support" }, cypher: ["// told\nMATCH (t:Team {id: $t})<-[r:TOLD]-(d:Decision {id: $d}) RETURN count(r) AS told"], sources: [], tokens: 1400 },
    { n: 3, kind: "text", tool: null, args: null, cypher: [], sources: [], tokens: 2940 },
  ],
  proposals: [
    { id: SAMPLE_APPROVALS.approvals[3].id, kind: "create_task", status: "pending", summary: SAMPLE_APPROVALS.approvals[3].summary },
    { id: SAMPLE_APPROVALS.approvals[4].id, kind: "create_issue", status: "failed", summary: SAMPLE_APPROVALS.approvals[4].summary },
  ],
};
