// v2 dashboard data for Ledgerly: tickets, PRs, deals, contracts, clauses, security, docs, goals.
// Deterministic: fixed constants and epoch seconds, no randomness, no Date.now(). Everything is anchored on
// NOW (2026-10-17 09:00 UTC, the day the demo is "today"). Every existing id and v1 number is unchanged:
// 40 customers on v1, 12 open v1 tickets, 3 open v1 deals, 2 guaranteeing contracts ($180k).
import type {
  Artifact, Blocker, Clause, Contract, Control, Deal, DocsStats, Edge, Finding, Framework, Goal, Incident,
  Page, PrRow, Risk, Source, Task, TicketRow, Vendor,
} from "@/lib/schemas";
import * as m from "./ledgerly";

const day = (d: string) => Math.floor(Date.parse(`${d}T09:00:00Z`) / 1000);
export const NOW = day("2026-10-17");
const H = 3600;
const D = 86400;
const ago = (days: number, hours = 0) => NOW - days * D - hours * H;

const cust = (n: number) => m.customers.find((c) => c.id === `cust-${n}`) ?? m.v2Customer;
type ExtraEdge = Edge & { extra?: Record<string, unknown> };
const edge = (from: string, to: string, type: Edge["type"], validFrom: number, o: { src?: Source; extra?: Record<string, unknown> } = {}): ExtraEdge =>
  ({ from, to, type, validFrom, validTo: null, ...o });

// ---------- tickets ----------
const SLA_HOURS = { urgent: 4, high: 8, normal: 24, low: 72 } as const;
type Pri = TicketRow["priority"];
const row = (
  id: string, title: string, status: TicketRow["status"], priority: Pri, createdAt: number, lagMin: number | null,
  assigneeId: string, customerId: string | null, systemId: string | null, v1Related: boolean,
): TicketRow => ({
  id, title, status, priority, createdAt, firstResponseAt: lagMin === null ? null : createdAt + lagMin * 60,
  slaDueAt: createdAt + SLA_HOURS[priority] * H, assigneeId, customerId, systemId, v1Related,
});

// The 12 open v1 tickets keep their artifacts; Ana is the escalation owner for all of them.
const v1Pri: Pri[] = ["high", "normal", "urgent", "normal", "high", "low", "normal", "high", "normal", "urgent", "normal", "high"];
const v1Lag = [25, 40, null, 70, 15, 180, 35, null, 55, 20, 45, 30];
const v1Tickets = v1Pri.map((p, i) =>
  row(`art-tkt-${i + 1}`, `${m.customers[i + 2].name}: API v1 errors`, "open", p, day("2026-10-01") + i * D, v1Lag[i], "p-ana", m.customers[i + 2].id, "api-v1", true));
const decoyTickets = [
  row("art-tkt-closed", "Closed: v1 timeout on /ledger", "closed", "normal", m.artifacts.find((a) => a.id === "art-tkt-closed")!.ts, 30, "p-ana", null, "api-v1", false),
  row("art-tkt-invoice", "Update v1 invoice template footer", "open", "low", m.artifacts.find((a) => a.id === "art-tkt-invoice")!.ts, null, "p-tomas", null, "billing", false),
];

// [title, customer number, system, priority, status, age in hours, first response lag in minutes, assignee]
const newTicketTable: [string, number, string, Pri, TicketRow["status"], number, number | null, string][] = [
  ["Webhook retries not firing on billing events", 19, "billing", "high", "open", 30, 45, "p-tomas"],
  ["Cannot export statements to CSV", 20, "web-app", "normal", "open", 52, 120, "p-nia"],
  ["Mobile app crashes on biometric login", 21, "mobile-app", "urgent", "open", 5, 12, "p-hugo"],
  ["Invoice shows wrong currency symbol", 22, "billing", "normal", "closed", 200, 60, "p-tomas"],
  ["Request: SSO for sub-accounts", 23, "web-app", "low", "open", 300, null, "p-nia"],
  ["Ledger totals differ after midnight UTC", 24, "ledger-db", "high", "open", 20, null, "p-ana"],
  ["SDK throws on nested pagination cursor", 25, "sdk-js", "normal", "open", 70, 300, "p-hugo"],
  ["Password reset email delayed", 26, "web-app", "normal", "closed", 150, 25, "p-nia"],
  ["Rate limit headers missing on API v2", 27, "api-v2", "high", "open", 12, 30, "p-tomas"],
  ["Mobile push notifications duplicated", 28, "mobile-app", "normal", "open", 40, 90, "p-hugo"],
  ["Dashboard chart blank in Safari", 29, "web-app", "low", "open", 120, null, "p-nia"],
  ["Refund stuck in pending for 5 days", 31, "billing", "urgent", "open", 9, 8, "p-ana"],
  ["Data export timeout for large accounts", 32, "ledger-db", "high", "open", 26, 400, "p-tomas"],
  ["How do I paginate with sdk-py?", 33, "sdk-py", "low", "closed", 400, 180, "p-hugo"],
  ["Tax line missing from PDF invoice", 34, "billing", "normal", "open", 60, 150, "p-nia"],
  ["Two-factor codes rejected intermittently", 35, "web-app", "high", "open", 6, null, "p-ana"],
  ["Webhook signature mismatch in sandbox", 36, "api-v2", "normal", "closed", 90, 50, "p-tomas"],
  ["Bulk import skips rows with commas", 37, "web-app", "normal", "open", 100, 600, "p-hugo"],
  ["Request: dark mode for mobile app", 38, "mobile-app", "low", "open", 500, null, "p-nia"],
  ["Reconciliation report duplicates entries", 39, "ledger-db", "high", "closed", 220, 45, "p-ana"],
  ["Idempotency key rejected on retry", 40, "api-v2", "urgent", "closed", 130, 15, "p-tomas"],
  ["Statement balance off by one cent", 41, "ledger-db", "normal", "open", 48, 200, "p-hugo"],
  ["SDK typings missing for refunds", 19, "sdk-js", "low", "open", 160, 700, "p-nia"],
  ["Team invite emails land in spam", 20, "web-app", "normal", "closed", 260, 35, "p-hugo"],
  ["Billing portal logs users out after 5 minutes", 21, "billing", "high", "open", 14, 20, "p-ana"],
];
const newTickets = newTicketTable.map(([title, c, sys, p, st, age, lag, who], i) =>
  row(`art-tkt-${i + 13}`, title, st, p, NOW - age * H, lag, who, cust(c).id, sys, false));
export const ticketRows: TicketRow[] = [...v1Tickets, ...decoyTickets, ...newTickets];

// ---------- PRs ----------
const pr = (
  id: string, title: string, repo: string, authorId: string, state: PrRow["state"], additions: number, deletions: number,
  createdAt: number, reviewLagH: number | null, mergeLagH: number | null, reviewerIds: string[], v1Related = false,
): PrRow => ({
  id, title, repo, authorId, state, additions, deletions, createdAt,
  firstReviewAt: reviewLagH === null ? null : createdAt + reviewLagH * H,
  mergedAt: state === "merged" && mergeLagH !== null ? createdAt + mergeLagH * H : null,
  reviewerIds, v1Related,
});
// pr-v1-1..9 (Priya, about api-v1): Sam reviewed 1..6; 7 is waiting on him; 8 merged unreviewed; 9 closed.
const v1States: PrRow["state"][] = ["merged", "merged", "merged", "merged", "merged", "merged", "open", "merged", "closed"];
const v1Prs = v1States.map((st, i) => {
  const n = i + 1;
  const at = day("2026-09-01") + i * 4 * D;
  return pr(`pr-v1-${n}`, `API v1 auth fix ${n}`, "api-v1", "p-priya", st, 40 + n * 13, 12 + n * 5, at,
    n <= 6 ? 6 + n : null, st === "merged" ? (n === 8 ? 3 : 20 + n) : null, n === 9 ? ["p-sam", "p-ravi"] : n === 8 ? [] : ["p-sam"], true);
});
const authPr = pr("art-pr-auth", "PR #212: rewrite v1 token refresh flow", "auth-service", "p-priya", "merged", 380, 210, day("2026-03-04"), 5, 26, ["p-sam"], true);
// [id, title, repo, author, state, +, -, age in days, review lag h, merge lag h, reviewers, v1]
const newPrTable: [string, string, string, string, PrRow["state"], number, number, number, number | null, number | null, string[], boolean][] = [
  ["pr-101", "sdk-js: default base URL to api.ledgerly.test/v2", "sdk-js", "p-kenji", "merged", 120, 96, 12, 4, 18, ["p-lena"], true],
  ["pr-102", "sdk-py: default base URL to api.ledgerly.test/v2", "sdk-py", "p-kenji", "open", 88, 71, 3, null, null, ["p-lena", "p-priya"], true],
  ["pr-103", "api-v2: accept v1 token format behind a flag", "api-v2", "p-lena", "open", 410, 35, 5, 9, null, ["p-priya", "p-sam"], true],
  ["pr-104", "web-app: show v1 deprecation banner", "web-app", "p-omar", "merged", 64, 4, 9, 2, 6, ["p-ravi"], true],
  ["pr-105", "auth-service: remove legacy signing key path", "auth-service", "p-lena", "open", 52, 640, 2, null, null, ["p-sam", "p-priya"], true],
  ["pr-106", "billing: fix duplicate webhook retries", "billing", "p-omar", "merged", 143, 61, 11, 3, 8, ["p-ravi"], false],
  ["pr-107", "ledger-db: add index on statements(account_id, ts)", "ledger-db", "p-lena", "merged", 12, 1, 10, 26, 30, ["p-kenji"], false],
  ["pr-108", "web-app: dark mode tokens", "web-app", "p-ravi", "merged", 782, 301, 14, 30, 52, ["p-omar", "p-kenji"], false],
  ["pr-109", "mobile-app: fix biometric login crash", "mobile-app", "p-omar", "merged", 33, 18, 1, null, 2, [], false],
  ["pr-110", "mobile-app: de-duplicate push notifications", "mobile-app", "p-omar", "open", 97, 40, 4, 6, null, ["p-ravi"], false],
  ["pr-111", "billing: refund state machine", "billing", "p-kenji", "open", 1260, 410, 6, 20, null, ["p-omar", "p-ravi"], false],
  ["pr-112", "api-v2: rate limit headers", "api-v2", "p-kenji", "merged", 58, 6, 7, 5, 12, ["p-priya"], false],
  ["pr-113", "ledger-db: nightly VACUUM job", "ledger-db", "p-lena", "closed", 74, 12, 13, 8, null, ["p-kenji"], false],
  ["pr-114", "web-app: CSV export for statements", "web-app", "p-omar", "open", 215, 22, 3, null, null, ["p-ravi", "p-kenji"], false],
  ["pr-115", "auth-service: tighten session expiry", "auth-service", "p-priya", "merged", 21, 9, 8, 3, 7, ["p-sam"], false],
  ["pr-116", "sdk-js: fix nested pagination cursor", "sdk-js", "p-kenji", "merged", 47, 15, 5, 4, 9, ["p-lena"], false],
  ["pr-117", "billing: tax line on PDF invoices", "billing", "p-ravi", "open", 188, 30, 2, null, null, ["p-omar"], false],
  ["pr-118", "web-app: bulk import CSV quoting", "web-app", "p-omar", "merged", 39, 10, 16, 48, 60, ["p-ravi"], false],
  ["pr-119", "ledger-db: statement rounding fix", "ledger-db", "p-lena", "merged", 9, 7, 6, null, 1, [], false],
  ["pr-120", "sdk-py: refund typings", "sdk-py", "p-kenji", "open", 66, 3, 1, null, null, ["p-lena"], false],
  ["pr-121", "mobile-app: 5.0 navigation shell", "mobile-app", "p-ravi", "open", 2410, 1890, 18, 72, null, ["p-omar", "p-kenji", "p-priya"], false],
];
const newPrs = newPrTable.map(([id, title, repo, who, st, a, d, ageD, rev, mrg, rv, v1]) =>
  pr(id, title, repo, who, st, a, d, ago(ageD), rev, mrg, rv, v1));
export const prRows: PrRow[] = [authPr, ...v1Prs, ...newPrs];

// ---------- incidents, deals, contracts, tasks ----------
export const incidents: Incident[] = [
  ...m.incidents,
  { id: "inc-2", title: "web-app deploy rolled back", severity: "high", systemId: "web-app", startedAt: ago(12, 2), acknowledgedAt: ago(12, 2) + 480, resolvedAt: ago(12, 2) + 2 * H },
  { id: "inc-3", title: "billing double charges", severity: "critical", systemId: "billing", startedAt: ago(9), acknowledgedAt: ago(9) + 240, resolvedAt: ago(9) + 5 * H },
  { id: "inc-4", title: "ledger-db replication lag", severity: "medium", systemId: "ledger-db", startedAt: ago(3), acknowledgedAt: ago(3) + 720, resolvedAt: null },
  { id: "inc-5", title: "auth-service legacy token verification errors", severity: "high", systemId: "auth-service", startedAt: ago(6), acknowledgedAt: ago(6) + 1200, resolvedAt: ago(6) + 4 * H },
  { id: "inc-6", title: "sdk-py 2.9.0 broken release", severity: "low", systemId: "sdk-py", startedAt: ago(1), acknowledgedAt: null, resolvedAt: null },
];

const PROB: Record<Deal["stage"], number> = { prospecting: 10, qualified: 25, proposal: 50, negotiation: 70, closed_won: 100, closed_lost: 0 };
// [customer number, what, stage, amount, close in days from NOW, owner]
const dealTable: [number, string, Deal["stage"], number, number, string][] = [
  [19, "Q4 renewal", "proposal", 42_000, 30, "p-bea"],
  [20, "seat expansion", "qualified", 28_000, 60, "p-carlos"],
  [21, "new logo", "prospecting", 65_000, 90, "p-dee"],
  [22, "annual upgrade", "negotiation", 54_000, 21, "p-arjun"],
  [23, "platform migration", "closed_won", 38_000, -12, "p-bea"],
  [24, "renewal", "closed_won", 22_000, -5, "p-arjun"],
  [25, "new logo", "closed_lost", 31_000, -20, "p-carlos"],
  [26, "enterprise pilot", "proposal", 80_000, 45, "p-dee"],
  [27, "add-on modules", "qualified", 18_000, 75, "p-bea"],
  [28, "multi-year renewal", "negotiation", 96_000, 14, "p-arjun"],
  [29, "new logo", "prospecting", 47_000, 120, "p-carlos"],
  [41, "API v2 upsell", "closed_won", 24_000, -8, "p-dee"],
];
export const deals: Deal[] = [
  ...m.deals,
  ...dealTable.map(([c, what, stage, amount, inDays, ownerId], i) => ({
    id: `deal-${i + 4}`, name: `${cust(c).name} ${what}`, stage, probability: PROB[stage], ownerId, amount,
    closeDate: NOW + inDays * D, customerId: cust(c).id, v1Related: false,
  })),
];
export const QUARTER_TARGET = 250_000;
const wonTotal = deals.filter((d) => d.stage === "closed_won").reduce((s, d) => s + d.amount, 0);

// [number, customer number, ends, notice days, value, approval]
const ctrTable: [number, number, string, number, number, Contract["approvalState"]][] = [
  [3, 3, "2026-12-31", 60, 24_000, "signed"],
  [4, 4, "2027-02-28", 30, 16_000, "in_review"],
  [5, 5, "2026-11-30", 90, 28_000, "signed"],
  [6, 6, "2027-04-15", 45, 12_000, "draft"],
  [7, 7, "2027-09-30", 60, 20_000, "approved"],
  [8, 8, "2026-12-15", 30, 36_000, "in_review"],
];
export const contracts: Contract[] = [
  ...m.contracts,
  ...ctrTable.map(([n, c, ends, notice, value, approvalState]) => ({
    id: `ctr-${n}`, name: `${cust(c).name} MSA`, endsAt: day(ends), customerId: cust(c).id, noticeDays: notice, value, approvalState,
  })),
];

export const tasks: Task[] = [
  ...m.tasks,
  { id: "task-3", title: "Complete customer security questionnaire: Northwind Capital", teamId: "security", assigneeId: "p-zoe", status: "open", createdAt: ago(6), kind: "questionnaire", dueAt: day("2026-10-25") },
  { id: "task-4", title: "Complete customer security questionnaire: Halden Bank", teamId: "security", assigneeId: "p-uri", status: "open", createdAt: ago(4), kind: "questionnaire", dueAt: day("2026-10-30") },
  { id: "task-5", title: "Quarterly access review: production admin", teamId: "security", assigneeId: "p-tara", status: "open", createdAt: ago(10), kind: "access_review", dueAt: day("2026-10-31") },
  { id: "task-6", title: "Access review: finance systems", teamId: "security", assigneeId: "p-zoe", status: "done", createdAt: ago(25), kind: "access_review", dueAt: day("2026-10-10") },
  { id: "task-7", title: "Review clause 7.2 exposure for Northwind Capital and Halden Bank", teamId: "legal", assigneeId: "p-noah", status: "open", createdAt: ago(9), kind: "review", dueAt: day("2026-10-24") },
  { id: "task-8", title: "Rewrite quickstart for API v2", teamId: "devrel", assigneeId: "p-eli", status: "open", createdAt: ago(8), kind: "general", dueAt: day("2026-11-05") },
];

// ---------- legal: clauses and the schedule documents that hold their text ----------
const SCHED = (ctr: string) => `art-sched-${ctr}`;
// [id, contract, number, title, text, risk, due, v1]
const clauseTable: [string, string, string, string, string, Clause["risk"], string | null, boolean][] = [
  ["clause-1", "ctr-1", "9.1", "Annual security report", "Ledgerly delivers an annual security report to the customer by 2026-12-01.", "med", "2026-12-01", false],
  ["clause-2", "ctr-1", "4.3", "Termination for convenience", "Either party may terminate for convenience with 90 days written notice.", "low", null, false],
  ["clause-3", "ctr-2", "6.4", "Audit rights", "The customer may audit Ledgerly security controls once per year with 30 days notice.", "med", "2026-11-20", false],
  ["clause-4", "ctr-3", "11.1", "Data breach liability", "Liability is uncapped for data breaches caused by Ledgerly.", "high", null, false],
  ["clause-5", "ctr-3", "7.5", "API retirement notice", "Ledgerly gives 180 days notice before retiring any API version the customer uses.", "high", null, true],
  ["clause-6", "ctr-4", "2.2", "Auto-renewal", "The agreement renews automatically for 12 months unless cancelled 30 days before the end date.", "med", null, false],
  ["clause-7", "ctr-5", "8.3", "SLA credits", "Ledgerly credits 10 percent of monthly fees for each full hour of downtime beyond the 99.9 percent SLA.", "med", null, false],
  ["clause-8", "ctr-5", "9.4", "Compliance evidence", "Ledgerly provides SOC 2 Type II evidence within 15 days of request.", "med", "2026-12-10", false],
  ["clause-9", "ctr-6", "3.1", "Vertical exclusivity", "Ledgerly grants the customer exclusivity in the freight vertical for 12 months.", "low", null, false],
  ["clause-10", "ctr-7", "10.2", "Data residency", "Customer data must stay in EU regions at all times.", "med", "2026-11-30", false],
  ["clause-11", "ctr-8", "5.5", "Price lock", "Prices are locked for 24 months and cannot be raised mid-term.", "low", null, false],
];
const guarantee = (who: string) =>
  `Ledgerly guarantees availability of API v1 until 2027-06-30 for ${who}.`;
export const clauses: Clause[] = [
  { id: "clause-g1", contractId: "ctr-1", number: "7.2", title: "API v1 availability guarantee", text: guarantee("Northwind Capital"), risk: "high", dueAt: null, src: { artifactId: "art-msa-northwind", quote: guarantee("Northwind Capital") }, v1Related: true },
  { id: "clause-g2", contractId: "ctr-2", number: "7.2", title: "API v1 availability guarantee", text: guarantee("Halden Bank"), risk: "high", dueAt: null, src: { artifactId: "art-msa-halden", quote: guarantee("Halden Bank") }, v1Related: true },
  ...clauseTable.map(([id, contractId, number, title, text, risk, due, v1Related]) => ({
    id, contractId, number, title, text, risk, dueAt: due ? day(due) : null, src: { artifactId: SCHED(contractId), quote: text }, v1Related,
  })),
];
/** One schedule document per contract that has non-guarantee clauses; the clause text is its verbatim quote. */
const schedDocs: Artifact[] = [...new Set(clauses.filter((c) => c.src.artifactId.startsWith("art-sched-")).map((c) => c.contractId))].map((ctr) => ({
  id: SCHED(ctr), kind: "doc" as const, title: `Contract schedule ${ctr}`,
  text: clauses.filter((c) => c.contractId === ctr && c.src.artifactId === SCHED(ctr)).map((c) => `Clause ${c.number}: ${c.text}`).join(" "),
  ts: day("2025-07-01"), uri: `mock://ledgerly/${SCHED(ctr)}`, authorId: "p-noah",
}));

/** Artifacts the v2 data adds (not in m.artifacts, so the embed cache and v1 evals stay untouched). */
export const extraArtifacts: Artifact[] = [
  ...newTickets.map((t) => ({
    id: t.id, kind: "ticket" as const, status: t.status, title: t.title,
    text: `${t.title}. Reported by ${cust(Number(t.customerId!.slice(5))).name}.`,
    ts: t.createdAt, uri: `mock://ledgerly/${t.id}`, authorId: t.assigneeId,
  })),
  ...schedDocs,
];

// ---------- security ----------
export const frameworks: Framework[] = [{ id: "fw-soc2", name: "SOC 2" }, { id: "fw-iso27001", name: "ISO 27001" }];
// [n, framework, name, status, auditBlocking, owner, v1]
const ctlTable: [number, string, string, Control["status"], boolean, string, boolean][] = [
  [1, "fw-soc2", "CC6.1 Logical access: key rotation", "failing", true, "p-sam", true],
  [2, "fw-soc2", "CC6.2 User provisioning", "passing", false, "p-zoe", false],
  [3, "fw-soc2", "CC6.6 Boundary protection", "passing", false, "p-uri", false],
  [4, "fw-soc2", "CC7.1 Vulnerability scanning", "passing", false, "p-uri", false],
  [5, "fw-soc2", "CC7.2 Incident monitoring", "passing", false, "p-sam", false],
  [6, "fw-soc2", "CC8.1 Change management", "failing", false, "p-zoe", false],
  [7, "fw-soc2", "A1.2 Availability monitoring", "passing", false, "p-tara", false],
  [8, "fw-soc2", "CC9.2 Vendor risk management", "failing", true, "p-tara", false],
  [9, "fw-iso27001", "A.5.15 Access control", "passing", false, "p-zoe", false],
  [10, "fw-iso27001", "A.8.24 Use of cryptography", "failing", true, "p-sam", true],
  [11, "fw-iso27001", "A.8.8 Technical vulnerability management", "passing", false, "p-uri", false],
  [12, "fw-iso27001", "A.5.19 Supplier relationships", "passing", false, "p-tara", false],
  [13, "fw-iso27001", "A.8.32 Change management", "passing", false, "p-zoe", false],
  [14, "fw-iso27001", "A.5.30 ICT readiness for continuity", "failing", false, "p-tara", false],
];
export const controls: Control[] = ctlTable.map(([n, frameworkId, name, status, auditBlocking, ownerId, v1Related]) =>
  ({ id: `ctl-${n}`, frameworkId, name, status, auditBlocking, ownerId, v1Related }));
export const vendors: Vendor[] = [
  { id: "vendor-1", name: "Amazon Web Services", riskTier: "high", assessmentStatus: "current", nextReview: day("2027-01-15") },
  { id: "vendor-2", name: "Stripe", riskTier: "high", assessmentStatus: "due", nextReview: day("2026-10-31") },
  { id: "vendor-3", name: "Datadog", riskTier: "medium", assessmentStatus: "current", nextReview: day("2027-03-01") },
  { id: "vendor-4", name: "SendGrid", riskTier: "medium", assessmentStatus: "overdue", nextReview: day("2026-09-30") },
  { id: "vendor-5", name: "Segment", riskTier: "low", assessmentStatus: "current", nextReview: day("2027-06-01") },
  { id: "vendor-6", name: "PagerDuty", riskTier: "low", assessmentStatus: "due", nextReview: day("2026-11-20") },
];
// [n, title, severity, system, sla, status, owner, found days ago, v1]
const findingTable: [number, string, Finding["severity"], string, string, Finding["status"], string, number, boolean][] = [
  [1, "v1 API keys never rotated", "high", "api-v1", "2026-10-31", "open", "p-sam", 10, true],
  [2, "Legacy v1 token verification path still enabled", "high", "auth-service", "2026-11-15", "in_progress", "p-uri", 9, true],
  [3, "Outdated TLS configuration on webhook endpoint", "medium", "billing", "2026-10-10", "open", "p-uri", 20, false],
  [4, "Backup bucket missing access logging", "low", "ledger-db", "2026-12-01", "open", "p-tara", 5, false],
  [5, "Dependency with known CVE in mobile-app", "critical", "mobile-app", "2026-10-20", "in_progress", "p-zoe", 3, false],
  [6, "Stale admin accounts in staging", "medium", "web-app", "2026-10-05", "resolved", "p-uri", 30, false],
];
export const findings: Finding[] = findingTable.map(([n, title, severity, systemId, sla, status, ownerId, , v1Related]) =>
  ({ id: `finding-${n}`, title, severity, slaDueAt: day(sla), systemId, status, ownerId, v1Related }));
export const risks: Risk[] = ([
  [1, "Sunset breaks enterprise v1 guarantees (clause 7.2)", 4, 5, "open", "p-mei", "legal", true],
  [2, "Customers miss the Jan 31 migration deadline", 4, 4, "mitigating", "p-dev", "devrel", true],
  [3, "Legacy signing key compromised before removal", 2, 5, "open", "p-sam", "security", true],
  [4, "Auth outage during key rotation", 2, 4, "mitigating", "p-lena", "eng", false],
  [5, "SendGrid outage delays invoices", 3, 3, "accepted", "p-tara", "security", false],
  [6, "Q4 bookings shortfall from deals that promised v1", 3, 4, "open", "p-dee", "sales", true],
] as [number, string, number, number, Risk["status"], string, string, boolean][]).map(([n, title, likelihood, impact, status, ownerId, teamId, v1Related]) =>
  ({ id: `risk-${n}`, title, likelihood, impact, status, ownerId, teamId, v1Related }));

// ---------- devrel ----------
export const pages: Page[] = ([
  [1, "/v1/quickstart", 48_200, 310, 940, true],
  [2, "/v2/quickstart", 9_100, 410, 60, false],
  [3, "/v1/auth/tokens", 21_400, 120, 380, true],
  [4, "/guides/migrate-v1-to-v2", 3_300, 150, 30, true],
  [5, "/sdk/js", 15_800, 540, 90, false],
  [6, "/sdk/python", 11_200, 420, 70, false],
  [7, "/reference/ledger", 27_500, 880, 210, false],
  [8, "/reference/webhooks", 12_400, 300, 160, false],
] as [number, string, number, number, number, boolean][]).map(([n, path, views30d, feedbackUp, feedbackDown, v1Related]) =>
  ({ id: `pg-${n}`, path, views30d, feedbackUp, feedbackDown, v1Related }));
export const docsStats: DocsStats = {
  id: "docs-stats",
  failedSearches: [
    { query: "migrate v1 to v2", count: 214 },
    { query: "v1 sunset date", count: 167 },
    { query: "refresh token v2", count: 98 },
    { query: "webhook signature", count: 71 },
    { query: "python pagination", count: 44 },
  ],
  sdkAdoption: [
    { sdk: "sdk-js", version: "3.4.x", share: 22 }, { sdk: "sdk-js", version: "3.3.x", share: 31 }, { sdk: "sdk-js", version: "2.x", share: 47 },
    { sdk: "sdk-py", version: "2.9.x", share: 18 }, { sdk: "sdk-py", version: "2.8.x", share: 34 }, { sdk: "sdk-py", version: "1.x", share: 48 },
  ],
};

// ---------- leadership ----------
export const goals: Goal[] = [
  { id: "goal-1", title: "Migrate every customer to API v2 by Jan 31", ownerTeamId: "eng", progress: 8, status: "at_risk" },
  { id: "goal-2", title: "Close Q4 enterprise renewals without breaching contracts", ownerTeamId: "sales", progress: 40, status: "off_track" },
  { id: "goal-3", title: "Pass the SOC 2 Type II audit", ownerTeamId: "security", progress: 62, status: "at_risk" },
  { id: "goal-q4", title: "Hit the Q4 bookings target", ownerTeamId: "sales", progress: Math.round((100 * wonTotal) / QUARTER_TARGET), status: "at_risk", target: QUARTER_TARGET, current: wonTotal },
  { id: "goal-5", title: "Cut median first response to 30 minutes", ownerTeamId: "support", progress: 71, status: "on_track" },
  { id: "goal-6", title: "Publish v2 docs and SDK defaults", ownerTeamId: "devrel", progress: 35, status: "at_risk" },
  { id: "goal-7", title: "Ship mobile-app 5.0", ownerTeamId: "eng", progress: 80, status: "on_track" },
];
const sunsetSrc: Source = { artifactId: "art-rfc14", quote: "API v1 will be shut down on Jan 31, 2027" };
export const blockers: (Blocker & { src?: Source })[] = [
  { fromId: "goal-2", toId: "d-1", since: ago(8), src: sunsetSrc },
  { fromId: "goal-3", toId: "finding-1", since: ago(10) },
  { fromId: "goal-6", toId: "task-1", since: ago(5) },
];

// ---------- edges (dated, so the overview can chart changes and acks per day) ----------
const personAcks: [string, "seen" | "concern", number][] = [
  ["p-kenji", "seen", 13], ["p-lena", "seen", 12], ["p-ravi", "seen", 11], ["p-tomas", "seen", 10], ["p-nia", "concern", 9],
  ["p-bea", "seen", 8], ["p-carlos", "seen", 8], ["p-dee", "concern", 6], ["p-vera", "seen", 5], ["p-jon", "seen", 4],
  ["p-rhea", "seen", 3], ["p-hugo", "seen", 2],
];
export const edges: ExtraEdge[] = [
  ...newTickets.flatMap((t) => [
    edge(t.id, t.systemId!, "ABOUT", t.createdAt),
    edge(t.id, t.customerId!, "RAISED_BY", t.createdAt),
    edge(t.id, t.assigneeId, "HANDLED_BY", t.createdAt),
  ]),
  ...newPrs.flatMap((p) => [
    edge(p.authorId, p.id, "AUTHORED", p.createdAt),
    edge(p.id, p.repo, "ABOUT", p.createdAt),
    ...(p.firstReviewAt ? [edge(p.reviewerIds[0], p.id, "REVIEWED", p.firstReviewAt)] : p.state === "open" ? p.reviewerIds.map((r) => edge(r, p.id, "REQUESTED_REVIEW", p.createdAt)) : []),
  ]),
  edge("p-priya", "art-pr-auth", "AUTHORED", authPr.createdAt),
  ...clauses.map((c) => edge(c.contractId, c.id, "HAS_CLAUSE", day("2025-07-01"), { src: c.src })),
  ...controls.map((c, i) => edge(c.id, c.frameworkId, "COVERS", day("2026-01-01") + i * D)),
  ...findingTable.map(([n, , , sys, , , , found]) => edge(`finding-${n}`, sys, "FOUND_IN", ago(found))),
  ...blockers.map((b) => edge(b.fromId, b.toId, "BLOCKED_BY", b.since, b.src ? { src: b.src } : {})),
  ...personAcks.map(([p, kind, d]) => edge(p, "d-1", "ACKED", ago(d), { extra: { kind, by: p } })),
  ...incidents.slice(1).map((i) => edge(i.id, i.systemId, "AFFECTED", i.startedAt)),
  ...[...pages.map((p) => ["devrel", p.id]), ...vendors.map((v) => ["security", v.id]), ...findings.map((f) => ["security", f.id]),
    ...risks.map((r) => [r.teamId, r.id]), ...goals.map((g) => ["leadership", g.id]), ["devrel", "docs-stats"]]
    .map(([t, id]) => edge(t, id, "OWNS", day("2026-01-01"))),
  ...contracts.slice(2).flatMap((c) => [edge(c.id, c.customerId, "PARTY_TO", day("2025-07-01")), edge(c.id, "legal", "MANAGED_BY", day("2025-07-01"))]),
  ...deals.slice(m.deals.length).flatMap((d) => [edge(d.id, d.customerId, "PARTY_TO", day("2026-01-01")), edge(d.id, "sales", "OWNED_BY", day("2026-01-01"))]),
];
