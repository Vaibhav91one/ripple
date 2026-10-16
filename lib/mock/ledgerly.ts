// Mock Ledgerly: the "Sunset API v1 on Jan 31" story. Deterministic, no randomness, no Date.now().
import type {
  Ack,
  Artifact,
  BottleneckRow,
  WhoKnowsRow,
  Brief,
  Change,
  Conflict,
  Contract,
  Customer,
  Deal,
  Decision,
  Edge,
  Incident,
  InboxItem,
  Person,
  RippleResult,
  Source,
  StreamEvent,
  System,
  Task,
  Team,
} from "@/lib/schemas";

const t = (d: string) => Math.floor(Date.parse(`${d}T09:00:00Z`) / 1000);

// ---------- teams, people, systems ----------
export const teams: Team[] = [
  ["eng", "Eng/Platform"],
  ["support", "Support"],
  ["sales", "Sales"],
  ["legal", "Legal"],
  ["security", "Security"],
  ["devrel", "DevRel"],
  ["finance", "Finance"],
  ["product", "Product"],
  ["data", "Data"],
].map(([id, name]) => ({ id, name }));

const person = (
  id: string,
  name: string,
  title: string,
  teamId: string,
): Person => ({
  id,
  name,
  title,
  email: `${name.toLowerCase()}@ledgerly.test`,
  teamId,
  active: true,
});
export const people: Person[] = [
  person("p-priya", "Priya", "Staff Engineer", "eng"),
  person("p-ana", "Ana", "Support Lead", "support"),
  person("p-arjun", "Arjun", "Account Executive", "sales"),
  person("p-mei", "Mei", "General Counsel", "legal"),
  person("p-sam", "Sam", "Security Engineer", "security"),
  person("p-dev", "Dev", "Developer Advocate", "devrel"),
  person("p-fin", "Fiona", "Finance Manager", "finance"),
  person("p-prod", "Pat", "Product Manager", "product"),
  person("p-data", "Dana", "Data Analyst", "data"),
];

export const systems: System[] = [
  {
    id: "api-v1",
    name: "API v1",
    kind: "api",
    status: "deprecated",
    version: "1",
    successor: "api-v2",
  },
  { id: "api-v2", name: "API v2", kind: "api", status: "current", version: "2" },
  { id: "auth-service", name: "auth-service", kind: "service", status: "current" },
  { id: "billing", name: "billing", kind: "service", status: "current" },
];

// ---------- customers (40 on v1 + 1 decoy already on v2) ----------
const adj = ["Alder", "Birch", "Cobalt", "Delta", "Ember", "Fjord", "Garnet", "Harbor"];
const noun = ["Labs", "Freight", "Health", "Retail", "Energy"];
export const customers: Customer[] = Array.from({ length: 40 }, (_, i) => ({
  id: `cust-${i + 1}`,
  name: `${adj[i % 8]} ${noun[i % 5]}`,
  arr: 8000 + (i % 6) * 4000, // 8k..28k
  tier: i % 7 === 0 ? ("growth" as const) : ("starter" as const),
  region: i % 3 === 0 ? "EU" : "US",
  monthlyCalls: 50_000 + i * 1_000,
}));
// The two contract customers: enterprise, $120k + $60k = $180k ARR at risk.
customers[0] = {
  id: "cust-1",
  name: "Northwind Capital",
  arr: 120_000,
  tier: "enterprise",
  region: "US",
  monthlyCalls: 2_400_000,
};
// Enterprise but quiet: call volume alone would hide this one.
customers[1] = {
  id: "cust-2",
  name: "Halden Bank",
  arr: 60_000,
  tier: "enterprise",
  region: "EU",
  monthlyCalls: 1_200,
};
export const v2Customer: Customer = {
  id: "cust-41",
  name: "Juniper Systems",
  arr: 24_000,
  tier: "growth",
  region: "US",
  monthlyCalls: 300_000,
};

// ---------- artifacts ----------
const art = (
  id: string,
  kind: Artifact["kind"],
  title: string,
  text: string,
  day: string,
  authorId: string,
  extra: Partial<Artifact> = {},
): Artifact => ({ id, kind, title, text, ts: t(day), uri: `mock://ledgerly/${id}`, authorId, ...extra });

const keyArtifacts: Artifact[] = [
  art(
    "art-rfc14",
    "doc",
    "RFC-14: Sunset API v1",
    "RFC-14: API v1 will be shut down on Jan 31, 2027. All customers must migrate to API v2 before that date. Tokens issued by the v1 auth flow stop working at shutdown.",
    "2026-09-15",
    "p-priya",
    { docKind: "rfc" },
  ),
  art(
    "art-meeting",
    "doc",
    "Platform planning meeting notes",
    "Planning meeting: Priya confirmed the Jan 31 sunset of API v1. Action: Support and Sales to be looped in. Legal has not been consulted yet.",
    "2026-09-22",
    "p-priya",
    { docKind: "meeting_notes" },
  ),
  art(
    "art-msa-northwind",
    "doc",
    "Northwind Capital MSA",
    "Master Services Agreement, clause 7.2: Ledgerly guarantees availability of API v1 until 2027-06-30 for Northwind Capital.",
    "2025-06-30",
    "p-mei",
  ),
  art(
    "art-msa-halden",
    "doc",
    "Halden Bank MSA",
    "Master Services Agreement, clause 7.2: Ledgerly guarantees availability of API v1 until 2027-06-30 for Halden Bank.",
    "2025-07-15",
    "p-mei",
  ),
  art(
    "art-auth-design",
    "doc",
    "auth-service design: token verification",
    "auth-service verifies v1 tokens through the legacy signing key. Removing API v1 means rotating that key and deleting the legacy verification path.",
    "2026-08-02",
    "p-sam",
  ),
  art(
    "art-sdk-docs",
    "doc",
    "Public docs and SDK quickstart",
    "All public SDK quickstarts and docs still point at api.ledgerly.test/v1 as the default base URL.",
    "2026-07-10",
    "p-dev",
  ),
  art(
    "art-pr-auth",
    "pr",
    "PR #212: rewrite v1 token refresh flow",
    "Priya rewrote the v1 auth token refresh flow in auth-service and wrote most of the original v1 auth handlers.",
    "2026-03-04",
    "p-priya",
  ),
  art(
    "art-secreview",
    "doc",
    "Security review: v1 auth flow",
    "Sam reviewed the v1 auth flow in auth-service and holds the threat model for the legacy token path.",
    "2026-05-19",
    "p-sam",
  ),
  // decoys
  art(
    "art-tkt-closed",
    "ticket",
    "Closed: v1 timeout on /ledger",
    "Closed: customer saw a timeout from API v1 on /ledger. Fixed by raising the gateway limit.",
    "2026-06-01",
    "p-ana",
    { status: "closed" },
  ),
  art(
    "art-tkt-invoice",
    "ticket",
    "Update v1 invoice template footer",
    "Update the footer text in the v1 invoice template PDF. Billing only, unrelated to the API.",
    "2026-10-02",
    "p-fin",
    { status: "open" },
  ),
  art(
    "art-msg-lost",
    "message",
    "Slack: Quill Logistics lost",
    "Lost the Quill Logistics deal, they went with a competitor. They had asked about API v1 pricing.",
    "2026-09-28",
    "p-arjun",
  ),
];

// 12 open tickets about v1, from customers cust-3..cust-14
const ticketCustomers = customers.slice(2, 14);
const tickets: Artifact[] = ticketCustomers.map((c, i) =>
  art(
    `art-tkt-${i + 1}`,
    "ticket",
    `${c.name}: API v1 errors`,
    `${c.name} reports 429 errors from API v1 on /ledger endpoints and asks whether v1 is going away.`,
    "2026-10-01",
    "p-ana",
    { status: "open" },
  ),
);

// 3 open deals promising v1 (customers cust-15..17)
const dealCustomers = customers.slice(14, 17);
const dealMessages: Artifact[] = dealCustomers.map((c, i) =>
  art(
    `art-msg-deal-${i + 1}`,
    "message",
    `Slack: ${c.name} renewal call`,
    `Told ${c.name} in the renewal call that API v1 stays available through 2027.`,
    "2026-10-05",
    "p-arjun",
  ),
);

export const artifacts: Artifact[] = [...keyArtifacts, ...tickets, ...dealMessages];
const artifactById = new Map(artifacts.map((a) => [a.id, a]));

/** Build a Source; throws at import time if the quote is not verbatim in the artifact. */
const src = (artifactId: string, quote: string): Source => {
  if (!artifactById.get(artifactId)?.text.includes(quote))
    throw new Error(`Quote not verbatim in ${artifactId}: ${quote}`);
  return { artifactId, quote };
};

// ---------- decisions, deals, contracts ----------
export const decisions: Decision[] = [
  { id: "d-0", title: "Launch API v1 as the public API", status: "superseded", decidedAt: t("2023-02-10") },
  { id: "d-1", title: "Sunset API v1 on Jan 31", status: "accepted", decidedAt: t("2026-09-22") },
];

export const deals: Deal[] = [
  ...dealCustomers.map((c, i) => ({
    id: `deal-${i + 1}`,
    name: `${c.name} expansion`,
    stage: "negotiation",
    amount: 30_000 + i * 5_000,
    closeDate: t("2026-11-15"),
    customerId: c.id,
  })),
  // decoy: lost deal
  { id: "deal-lost", name: "Quill Logistics new logo", stage: "closed_lost", amount: 45_000, closeDate: t("2026-09-28"), customerId: "cust-18" },
];

export const contracts: Contract[] = [
  { id: "ctr-1", name: "Northwind Capital MSA", endsAt: t("2027-06-30"), customerId: "cust-1" },
  { id: "ctr-2", name: "Halden Bank MSA", endsAt: t("2027-06-30"), customerId: "cust-2" },
];

// ---------- edges ----------
const FROM = t("2026-01-01");
const usesV1: Edge[] = customers.map((c) => ({ from: c.id, to: "api-v1", type: "USES", validFrom: FROM, validTo: null }));
const ticketEdges: Edge[] = tickets.map((a) => ({
  from: a.id, to: "api-v1", type: "ABOUT", validFrom: a.ts, validTo: null, src: src(a.id, "429 errors from API v1"),
}));
const dealEdges: Edge[] = dealMessages.map((a, i) => ({
  from: `deal-${i + 1}`, to: "api-v1", type: "PROMISED", validFrom: a.ts, validTo: null, src: src(a.id, "API v1 stays available through 2027"),
}));
const guaranteeEdges: Edge[] = contracts.map((c, i) => ({
  from: c.id, to: "api-v1", type: "GUARANTEES", validFrom: t("2025-07-01"), validTo: null,
  src: src(i === 0 ? "art-msa-northwind" : "art-msa-halden", "guarantees availability of API v1 until 2027-06-30"),
}));
const sunsetsEdge: Edge = {
  from: "d-1", to: "api-v1", type: "SUNSETS", validFrom: t("2026-09-22"), validTo: null,
  src: src("art-rfc14", "API v1 will be shut down on Jan 31, 2027"),
};
export const edges: Edge[] = [
  sunsetsEdge,
  { from: "auth-service", to: "api-v1", type: "DEPENDS_ON", validFrom: FROM, validTo: null, src: src("art-auth-design", "auth-service verifies v1 tokens") },
  { from: "p-priya", to: "api-v1", type: "AUTHORED", validFrom: FROM, validTo: null, src: src("art-pr-auth", "wrote most of the original v1 auth handlers") },
  { from: "cust-41", to: "api-v2", type: "USES", validFrom: FROM, validTo: null },
  ...usesV1,
  ...ticketEdges,
  ...dealEdges,
  ...guaranteeEdges,
];

// ---------- conflict, incident, tasks, acks ----------
export const conflict: Conflict = {
  id: "conf-1",
  kind: "sunset_vs_guarantee",
  severity: "high",
  status: "open",
  decisionId: "d-1",
  contractIds: ["ctr-1", "ctr-2"],
  detectedAt: t("2026-10-06"),
  sources: [
    src("art-rfc14", "API v1 will be shut down on Jan 31, 2027"),
    src("art-msa-northwind", "guarantees availability of API v1 until 2027-06-30"),
    src("art-msa-halden", "guarantees availability of API v1 until 2027-06-30"),
  ],
};
export const incidents: Incident[] = [
  { id: "inc-1", title: "API v1 elevated 429s", severity: "medium", systemId: "api-v1", startedAt: t("2026-09-30"), resolvedAt: t("2026-09-30") + 7200 },
];
export const tasks: Task[] = [
  { id: "task-1", title: "Draft v1 migration guide", teamId: "devrel", assigneeId: "p-dev", status: "open", createdAt: t("2026-10-07") },
  { id: "task-2", title: "Review customer sunset email", teamId: "eng", assigneeId: "p-priya", status: "in_review", createdAt: t("2026-10-09") },
];
export const acks: Ack[] = [
  { teamId: "eng", decisionId: "d-1", kind: "seen", by: "p-priya", at: t("2026-09-22") },
  { teamId: "support", decisionId: "d-1", kind: "seen", by: "p-ana", at: t("2026-09-23") },
  { teamId: "sales", decisionId: "d-1", kind: "concern", by: "p-arjun", at: t("2026-09-24") },
];

// ---------- ripple ----------
const affectedTeams = ["support", "sales", "legal", "security", "devrel"];
const teamEdges: Edge[] = affectedTeams.map((id) => ({
  from: id, to: "api-v1", type: "AFFECTED", validFrom: t("2026-09-22"), validTo: null,
}));
const rippleNodes: RippleResult["nodes"] = [
  { id: "d-1", label: decisions[1].title, kind: "decision", hop: 0 },
  { id: "api-v1", label: "API v1", kind: "system", hop: 1 },
  ...customers.map((c) => ({ id: c.id, label: c.name, kind: "customer" as const, hop: 2 })),
  ...tickets.map((a) => ({ id: a.id, label: a.title, kind: "ticket" as const, hop: 2 })),
  ...dealCustomers.map((c, i) => ({ id: `deal-${i + 1}`, label: deals[i].name, kind: "deal" as const, hop: 2 })),
  ...contracts.map((c) => ({ id: c.id, label: c.name, kind: "contract" as const, hop: 2 })),
  ...affectedTeams.map((id) => ({ id, label: teams.find((x) => x.id === id)!.name, kind: "team" as const, hop: 3 })),
];

export const rippleResult: RippleResult = {
  decision: decisions[1],
  nodes: rippleNodes,
  edges: [sunsetsEdge, ...usesV1, ...ticketEdges, ...dealEdges, ...guaranteeEdges, ...teamEdges].map(({ from, to, type }) => ({ from, to, type })),
  teams: [
    {
      teamId: "eng", involved: true, acked: true,
      why: [{ reason: "Owns API v1 and made the decision", ref: "d-1", source: src("art-rfc14", "API v1 will be shut down on Jan 31, 2027") }],
    },
    {
      teamId: "support", involved: true, acked: true,
      why: [{ reason: "12 open tickets about API v1", ref: "art-tkt-1", source: src("art-tkt-1", "429 errors from API v1") }],
    },
    {
      teamId: "sales", involved: true, acked: true,
      why: [{ reason: "3 open deals promise v1 through 2027", ref: "deal-1", source: src("art-msg-deal-1", "API v1 stays available through 2027") }],
    },
    {
      teamId: "legal", involved: false, acked: false,
      why: [{ reason: "2 contracts guarantee v1 until 2027-06-30", ref: "ctr-1", source: src("art-msa-northwind", "guarantees availability of API v1 until 2027-06-30") }],
    },
    {
      teamId: "security", involved: false, acked: false,
      why: [{ reason: "auth-service verifies v1 tokens", ref: "auth-service", source: src("art-auth-design", "auth-service verifies v1 tokens") }],
    },
    {
      teamId: "devrel", involved: false, acked: false,
      why: [{ reason: "Public docs and SDKs default to /v1", ref: "art-sdk-docs", source: src("art-sdk-docs", "still point at api.ledgerly.test/v1") }],
    },
  ],
  gap: ["legal", "security", "devrel"],
  conflicts: [conflict],
  // teamsAffected excludes the deciding team (Eng); arrAtRisk = ARR of customers whose contracts guarantee v1
  counts: { teamsAffected: 5, notTold: 3, conflicts: 1, customers: 40, tickets: 12, deals: 3, contracts: 2, arrAtRisk: 180_000 },
  cypher: [
    {
      name: "blast radius",
      text: "// everything within 2 hops of the decision\nMATCH (d:Decision {id:$id})-[:AFFECTS]->(s:System)<-[r:USES|ABOUT|PROMISES|GUARANTEES]-(x)\nWHERE r.validTo IS NULL\nRETURN s, r, x",
    },
    {
      name: "teams not told",
      text: "// affected teams with no ack for the decision\nMATCH (t:Team)-[:OWNS|WORKS_ON]->(x)-[:USES|ABOUT|PROMISES|GUARANTEES|SERVES]->(:System {id:'api-v1'})\nWHERE NOT (t)-[:ACKED]->(:Decision {id:$id})\nRETURN DISTINCT t",
    },
  ],
};

// ---------- briefs for the 3 gap teams ----------
const sunset = src("art-rfc14", "API v1 will be shut down on Jan 31, 2027");
export const briefs: Brief[] = [
  {
    teamId: "legal", decisionId: "d-1",
    claims: [
      { text: "Engineering will shut down API v1 on Jan 31, 2027.", sources: [sunset] },
      { text: "Two contracts guarantee API v1 until 2027-06-30 under clause 7.2.", sources: [src("art-msa-northwind", "guarantees availability of API v1 until 2027-06-30"), src("art-msa-halden", "guarantees availability of API v1 until 2027-06-30")] },
      { text: "Legal was not consulted before the decision.", sources: [src("art-meeting", "Legal has not been consulted yet")] },
    ],
  },
  {
    teamId: "security", decisionId: "d-1",
    claims: [
      { text: "v1 tokens stop working at shutdown.", sources: [src("art-rfc14", "Tokens issued by the v1 auth flow stop working at shutdown")] },
      { text: "Removal means rotating the legacy signing key and deleting the legacy verification path.", sources: [src("art-auth-design", "rotating that key and deleting the legacy verification path")] },
    ],
  },
  {
    teamId: "devrel", decisionId: "d-1",
    claims: [
      { text: "All customers must migrate to API v2 before Jan 31, 2027.", sources: [src("art-rfc14", "All customers must migrate to API v2 before that date")] },
      { text: "Public docs and SDK quickstarts still default to the v1 base URL.", sources: [src("art-sdk-docs", "still point at api.ledgerly.test/v1")] },
    ],
  },
];

// ---------- changes, bottleneck, inbox ----------
export const changes: Change[] = [
  { kind: "added", at: t("2026-10-06"), edge: guaranteeEdges[0] },
  { kind: "added", at: t("2026-10-05"), edge: dealEdges[0] },
  // customer migrated off v1 (ended edge)
  { kind: "ended", at: t("2026-10-10"), edge: { from: "cust-30", to: "api-v1", type: "USES", validFrom: FROM, validTo: t("2026-10-10") } },
  { kind: "added", at: t("2026-10-10"), edge: { from: "cust-30", to: "api-v2", type: "USES", validFrom: t("2026-10-10"), validTo: null } },
];

// Built from WAITING_ON edges between teams.
export const bottleneck: BottleneckRow[] = [
  { blockerTeamId: "legal", openRequests: 4, totalWaitDays: 38, oldestDays: 17, waitingTeamIds: ["sales", "eng", "finance"] },
  { blockerTeamId: "security", openRequests: 3, totalWaitDays: 21, oldestDays: 11, waitingTeamIds: ["eng", "devrel"] },
  { blockerTeamId: "eng", openRequests: 2, totalWaitDays: 9, oldestDays: 6, waitingTeamIds: ["support"] },
];

export const whoKnows: Record<string, WhoKnowsRow[]> = {
  "api-v1": [
    { personId: "p-priya", systemId: "api-v1", authored: 9, reviewed: 2, handled: 4, lastSeen: t("2026-10-15") }, // 9 of the last 12 PRs
    { personId: "p-sam", systemId: "api-v1", authored: 1, reviewed: 6, handled: 1, lastSeen: t("2026-10-09") },
    { personId: "p-ana", systemId: "api-v1", authored: 0, reviewed: 0, handled: 12, lastSeen: t("2026-10-16") },
  ],
};

export const inboxes: Record<string, InboxItem[]> = {
  "p-priya": [
    { id: "in-1", kind: "brief", title: "Brief: Legal on the v1 sunset", at: t("2026-10-12"), teamId: "legal", decisionId: "d-1" },
    { id: "in-2", kind: "review", title: "Review customer sunset email", at: t("2026-10-09"), taskId: "task-2", from: "p-prod" },
    { id: "in-3", kind: "waiting", title: "Waiting on Mei: clause 7.2 exposure", at: t("2026-10-08"), waitingOn: "p-mei" },
  ],
};

// ---------- Ask: "Who knows the v1 auth flow?" ----------
export const askQuestion = "Who knows the v1 auth flow?";
const priyaSrc = src("art-pr-auth", "wrote most of the original v1 auth handlers");
const samSrc = src("art-secreview", "holds the threat model for the legacy token path");
export const askEvents: StreamEvent[] = [
  {
    type: "tool_call",
    tool: "people_for_system",
    args: { system: "auth-service", flow: "v1 auth" },
    cypher: "// who touched the v1 auth flow\nMATCH (p:Person)-[r:AUTHORED|REVIEWED]->(s:System)\nWHERE s.id IN ['auth-service','api-v1']\nRETURN p, count(r) AS n ORDER BY n DESC",
  },
  {
    type: "tool_result",
    tool: "people_for_system",
    rows: [
      { personId: "p-priya", n: 31 },
      { personId: "p-sam", n: 12 },
    ],
    sourceIds: ["art-pr-auth", "art-secreview"],
  },
  { type: "text_delta", text: "Priya (Eng) knows it best: she wrote most of the original v1 auth handlers. " },
  { type: "citation", claimId: "claim-1", sources: [priyaSrc] },
  { type: "text_delta", text: "Sam (Security) holds the threat model for the legacy token path." },
  { type: "citation", claimId: "claim-2", sources: [samSrc] },
  { type: "done" },
];

