// Agent tools = the Cypher templates. The model picks a tool and fills params; it never writes Cypher.
import { createHash } from "node:crypto";
import { z } from "zod";
import { roQuery, type Graph } from "../graph/client";
import { bottleneck, decisions, load, NotFound, ripple, search, whoKnows, whyAffected, type Cypher } from "../graph/queries";
import { claimsBody, claimsFor } from "../briefs";
import type { ActionKind } from "./define";
import type { Source } from "../schemas";
import type { RestrictedSummary } from "../schemas/common";
import type { PermViewer } from "../permissions/redact";
import type { LanguageModel } from "ai";

export type Row = Record<string, unknown>;
export type ToolOut = { rows: Row[]; sources: Source[]; cypher: Cypher[]; /** what redaction withheld from this viewer */ restricted?: RestrictedSummary[] };
/** Who is asking. Tool output is redacted for them; teamIds missing = no teams = nothing restricted is shown. */
export type Viewer = PermViewer & { kind?: string; id?: string };
/** Background runs only: who the run acts for and a stub for proposing writes. Interactive /api/ask leaves them unset. */
export type RunCtx = {
  viewer: Viewer;
  org: { id: string };
  runId: string;
  /** Records a pending action for a person to approve (lib/actions/propose). Agents never write directly. */
  propose: (kind: ActionKind, payload: unknown, evidence?: unknown) => Promise<{ id: string; status: string; created: boolean }>;
};
export type Ctx = { g: Graph; now: number; demo: boolean; /** Anonymous demo viewer: write tools throw "demo_readonly". */ readonly?: boolean; viewer?: Viewer; /** run_agent: the model its inline runs use; unset = the configured agent model. Also the offline-eval seam. */ model?: LanguageModel } & Partial<Omit<RunCtx, "viewer">>;
type Def<I extends z.ZodType> = {
  description: string;
  input: I;
  /** Template names, shown to the user in the tool_call event before the tool runs. */
  templates: string[];
  /** Set on a tool that proposes this action kind. defineAgent rejects it unless the agent's `writes` lists the kind. */
  proposes?: ActionKind;
  run: (ctx: Ctx, args: z.infer<I>) => Promise<ToolOut>;
};
const def = <I extends z.ZodType>(d: Def<I>) => d;

const QUOTE_LEN = 160;
const STALE_DAYS = 90;
/** Sources for artifact ids, quoting the start of the artifact text (always a verbatim substring). */
async function sourcesFor(g: Graph, ids: string[]): Promise<{ sources: Source[]; cypher: Cypher }> {
  const c = load("artifact-text");
  const rows = await roQuery<{ id: string; text: string | null }>(g, c.text, { ids: [...new Set(ids)] });
  const sources = rows.flatMap((r) => (r.text?.trim() ? [{ artifactId: r.id, quote: r.text.trim().slice(0, QUOTE_LEN) }] : []));
  return { sources, cypher: c };
}
/** Honest empty answer: one row the model can report plainly instead of guessing. */
export const notInGraph = (what: string): Row[] => [{ found: false, note: `Nothing in the graph connects to ${what}. The dependency may not be modelled.` }];
/** An unknown decision id: say so, and list the real ids so the model can retry instead of guessing again. */
const unknownDecision = async (g: Graph, id: string): Promise<Row[]> => {
  const known = (await decisions(g)).data.map((d) => ({ id: d.id, title: d.title }));
  return [{ ...notInGraph(`decision ${id}`)[0], knownDecisions: known, hint: "Retry with one of knownDecisions[].id if it matches." }];
};
/** An unknown system id: say so, and list the real ids (artifact ids like art-* are not systems). */
const unknownSystem = async (g: Graph, id: string): Promise<Row[]> => {
  const known = await roQuery<{ id: string; name: string | null }>(g, load("systems").text);
  return [{ ...notInGraph(id)[0], knownSystems: known, hint: "who_knows takes a system id, not an artifact id. Retry with the knownSystems[].id the question is about." }];
};
const dedupe = (xs: Source[]) => [...new Map(xs.map((s) => [s.artifactId, s])).values()];

type GapRow = { personId: string; name: string | null; teamId: string; resourceId: string; resourceName: string; resourceKind: "group" | "software"; systemId: string; status: "missing" | "unknown" };
type GapChange = { id: string; title: string | null; effectiveAt: number | null; src: string | null; quote: string | null };
/** Affected teams' people minus the software and access groups the change's systems REQUIRE. Held and fresh = has; no identity data newer than 90 days = unknown, never missing. */
async function accessGap(g: Graph, now: number, decisionId: string) {
  const r = await ripple(g, decisionId, now).catch((e) => (e instanceof NotFound ? null : Promise.reject(e)));
  if (!r) return null;
  const gc = load("access-gap");
  const cc = load("access-change");
  const [rows, [change]] = await Promise.all([
    roQuery<Omit<GapRow, "status"> & { heldAt: number | null; lastIdentity: number | null }>(g, gc.text, { id: decisionId, teams: r.teams.map((t) => t.teamId) }),
    roQuery<GapChange>(g, cc.text, { id: decisionId }),
  ]);
  const fresh = (t: number | null) => t !== null && t >= now - STALE_DAYS * 86400;
  const all = rows.map(({ heldAt, lastIdentity, ...x }) => ({ ...x, status: heldAt !== null ? (fresh(heldAt) ? "has" : "unknown") : fresh(lastIdentity) ? "missing" : "unknown" }) as Omit<GapRow, "status"> & { status: GapRow["status"] | "has" });
  return { gaps: all.filter((x): x is GapRow => x.status !== "has"), checked: all.length, change, cypher: [gc, cc] };
}

export const TOOLS = {
  search: def({
    description: "Full-text search over documents, tickets, messages and PRs. Use for open-ended questions.",
    input: z.object({ text: z.string().min(1).describe("Search words") }),
    templates: ["search", "artifact-text"],
    run: async ({ g }, { text }) => {
      const hits = await search(g, text);
      const s = await sourcesFor(g, hits.data.map((h) => h.id));
      return { rows: hits.data.length ? hits.data : notInGraph(`"${text}"`), sources: s.sources, cypher: [...hits.cypher, s.cypher] };
    },
  }),
  ripple: def({
    description: "Everything a decision touches: affected teams, which were never told (gap), conflicts, customers and ARR at risk.",
    input: z.object({
      decisionId: z.string().describe("Decision id, e.g. d-1"),
      depth: z.number().int().min(1).max(4).optional().describe("How many dependency hops to follow from the sunset system (1-4, default 3)"),
    }),
    templates: ["decision", "ripple", "gap", "conflicts-detect"],
    run: async ({ g, now }, { decisionId, depth = 3 }) => {
      const r = await ripple(g, decisionId, now, depth).catch((e) => (e instanceof NotFound ? null : Promise.reject(e)));
      if (!r) return { rows: await unknownDecision(g, decisionId), sources: [], cypher: [] };
      const rows: Row[] = [{
        decision: r.decision, counts: r.counts, gap: r.gap,
        teams: r.teams.map((t) => ({ teamId: t.teamId, involved: t.involved, acked: t.acked, why: t.why.map((w) => w.reason) })),
        conflicts: r.conflicts.map((c) => ({ id: c.id, severity: c.severity, contractIds: c.contractIds })),
      }];
      const sources = dedupe([...r.teams.flatMap((t) => t.why.map((w) => w.source)), ...r.conflicts.flatMap((c) => c.sources)]);
      return { rows, sources, cypher: r.cypher };
    },
  }),
  who_knows: def({
    description: "Top active people who know a system best (authored/reviewed PRs, handled tickets), with the evidence artifacts.",
    input: z.object({ systemId: z.string().describe("System id, e.g. api-v1 or auth-service") }),
    templates: ["who-knows", "artifact-text"],
    run: async ({ g }, { systemId }) => {
      const w = await whoKnows(g, systemId);
      if (!w.data.length) return { rows: await unknownSystem(g, systemId), sources: [], cypher: [...w.cypher, load("systems")] };
      const s = await sourcesFor(g, w.data.flatMap((p) => p.evidence).slice(0, 25));
      return { rows: w.data, sources: s.sources, cypher: [...w.cypher, s.cypher] };
    },
  }),
  trace_decision: def({
    description: "A decision with the artifacts that support it (why it was made, who said so).",
    input: z.object({ decisionId: z.string().describe("Decision id, e.g. d-1") }),
    templates: ["decision", "trace-decision"],
    run: async ({ g }, { decisionId }) => {
      const dc = load("decision");
      const tc = load("trace-decision");
      const [d] = await roQuery<{ id: string; title: string; status: string; src: string | null; quote: string | null }>(g, dc.text, { id: decisionId });
      if (!d) return { rows: await unknownDecision(g, decisionId), sources: [], cypher: [dc] };
      const sup = await roQuery<{ sourceId: string | null; sourceTitle: string | null; quote: string | null }>(g, tc.text, { id: decisionId });
      const supported = sup.filter((x) => x.sourceId);
      const s = await sourcesFor(g, supported.map((x) => x.sourceId!));
      const sources = dedupe([
        ...(d.src && d.quote ? [{ artifactId: d.src, quote: d.quote }] : []),
        ...supported.flatMap((x) => (x.quote ? [{ artifactId: x.sourceId!, quote: x.quote }] : [])),
        ...s.sources,
      ]);
      const rows = [{ id: d.id, title: d.title, status: d.status, supportedBy: supported.map((x) => ({ id: x.sourceId, title: x.sourceTitle })), sunsetSource: d.src }];
      return { rows, sources, cypher: [dc, tc, s.cypher] };
    },
  }),
  bottleneck: def({
    description: "Which teams are blocking the most open requests from other teams, and for how long.",
    input: z.object({}),
    templates: ["bottleneck"],
    run: async ({ g, now }) => {
      const b = await bottleneck(g, now);
      return { rows: b.data, sources: [], cypher: b.cypher };
    },
  }),
  why_affected: def({
    description: "The shortest path of evidence from a decision to one team (decision, system, contract/deal/ticket, team), with the source quote on each hop. Use it to show why a not-told team is affected.",
    input: z.object({ decisionId: z.string().describe("Decision id, e.g. d-1"), teamId: z.string().describe("Team id, e.g. legal") }),
    templates: ["why-affected", "why-affected-any", "artifact-text"],
    run: async ({ g }, { decisionId, teamId }) => {
      const w = await whyAffected(g, decisionId, teamId);
      if (!w.data) {
        const known = (await decisions(g)).data;
        if (!known.some((d) => d.id === decisionId)) return { rows: await unknownDecision(g, decisionId), sources: [], cypher: w.cypher };
        return { rows: [{ found: false, note: `No path from decision ${decisionId} to team ${teamId} in the graph.` }], sources: [], cypher: w.cypher };
      }
      const { nodes, rels } = w.data;
      const sources = dedupe(rels.flatMap((r) => (r.src && r.quote ? [{ artifactId: r.src, quote: r.quote }] : [])));
      return { rows: [{ found: true, hops: rels.length, nodes, rels }], sources, cypher: w.cypher };
    },
  }),
  edge_freshness: def({
    description: "How recent (observed_at) and how sure (confidence) the ownership, contract and deal edges behind a decision's ripple are. Edges older than 90 days are flagged stale. Use it to set confidence and freshness in an impact report.",
    input: z.object({ decisionId: z.string().describe("Decision id, e.g. d-1"), depth: z.number().int().min(1).max(4).describe("Dependency hops, 1-4. Use 4 to include the deepest edges.") }),
    templates: ["edge-freshness", "artifact-text"],
    run: async ({ g, now }, { decisionId, depth }) => {
      const c = load("edge-freshness");
      const rows = await roQuery<{ id: string; rel: string; systemId: string; hop: number; observedAt: number | null; confidence: number; src: string | null }>(g, c.text, { id: decisionId, maxHops: depth });
      if (!rows.length) return { rows: await unknownDecision(g, decisionId), sources: [], cypher: [c] };
      const s = await sourcesFor(g, rows.flatMap((r) => (r.src ? [r.src] : [])));
      const out: Row[] = rows.map((r) => ({ ...r, stale: r.observedAt === null || r.observedAt < now - STALE_DAYS * 86400 }));
      return { rows: out, sources: s.sources, cypher: [c, s.cypher] };
    },
  }),
  contract_conflicts: def({
    description: "Open conflicts between a decision and contract guarantees: severity, contracts involved, and the quotes (change side and contract side). Restricted to Legal.",
    input: z.object({ decisionId: z.string().describe("Decision id, e.g. d-1") }),
    templates: ["conflicts-list", "artifact-text"],
    run: async ({ g }, { decisionId }) => {
      const c = load("conflicts-list");
      const rows = (await roQuery<{ id: string; severity: string; status: string; decisionId: string; contractIds: string[]; detectedAt: number; sources: string }>(g, c.text, { id: decisionId })).filter((k) => k.status === "open");
      if (!rows.length) return { rows: [{ found: false, note: `No open contract conflict for decision ${decisionId}.` }], sources: [], cypher: [c] };
      const srcs = rows.flatMap((k) => JSON.parse(k.sources) as Source[]);
      const s = await sourcesFor(g, srcs.map((x) => x.artifactId));
      const out: Row[] = rows.map(({ sources: _s, ...k }) => (void _s, k));
      return { rows: out, sources: dedupe([...srcs, ...s.sources]), cypher: [c, s.cypher] };
    },
  }),
  contract_clauses: def({
    description: "The numbered clauses of one contract (number, title, text, risk, due date) with the contract document that holds them. Restricted to Legal: other viewers get a count only.",
    input: z.object({ contractId: z.string().describe("Contract id, e.g. ctr-1") }),
    templates: ["contract-clauses", "artifact-text"],
    run: async ({ g }, { contractId }) => {
      const c = load("contract-clauses");
      const rows = await roQuery<{ src: string | null }>(g, c.text, { id: contractId });
      if (!rows.length) return { rows: notInGraph(`contract ${contractId}`), sources: [], cypher: [c] };
      const s = await sourcesFor(g, rows.flatMap((r) => (r.src ? [r.src] : [])));
      return { rows: rows as Row[], sources: s.sources, cypher: [c, s.cypher] };
    },
  }),
  contract_renewals: def({
    description: "Contracts that end within the next N days, with end date and notice period. Restricted to Legal.",
    input: z.object({ withinDays: z.number().int().min(1).max(365).describe("Look-ahead window in days, e.g. 90") }),
    templates: ["contract-renewals"],
    run: async ({ g, now }, { withinDays }) => {
      const c = load("contract-renewals");
      const rows = await roQuery<Row>(g, c.text, { now, within: withinDays * 86400 });
      return { rows: rows.length ? rows : [{ found: false, note: `No contract ends within ${withinDays} days.` }], sources: [], cypher: [c] };
    },
  }),
  propose_draft: def({
    description: "Propose a draft notice or amendment document for Legal to review. It is saved as a pending draft_doc that a person approves; nothing is sent to anyone.",
    input: z.object({
      kind: z.enum(["notice", "amendment"]),
      contractId: z.string().describe("Contract id, e.g. ctr-1"),
      decisionId: z.string().describe("Decision id the draft responds to, e.g. d-1"),
      title: z.string().min(1),
      body: z.string().min(1).describe("The full draft text, quoting the clause it responds to"),
    }),
    templates: [],
    proposes: "draft_doc",
    run: async ({ readonly, propose }, args) => {
      if (readonly) throw new Error("demo_readonly");
      if (!propose) return { rows: [{ proposed: false, reason: "approvals_unavailable" }], sources: [], cypher: [] };
      return { rows: [{ ...(await propose("draft_doc", args, args)) }], sources: [], cypher: [] };
    },
  }),
  propose_task: def({
    description: "Propose one open task for a team (for example Legal), for a person to approve before it exists.",
    input: z.object({
      teamId: z.string().describe("Team id, e.g. legal"),
      decisionId: z.string().describe("Decision id the task is about, or the contract id for a renewal task"),
      title: z.string().min(1),
      body: z.string().describe("What to do and why, citing the clause"),
    }),
    templates: [],
    proposes: "create_task",
    run: async ({ readonly, propose }, a) => {
      if (readonly) throw new Error("demo_readonly");
      if (!propose) return { rows: [{ proposed: false, reason: "approvals_unavailable" }], sources: [], cypher: [] };
      const payload = { id: `task-${a.decisionId}-${a.teamId}-${createHash("sha1").update(a.title).digest("hex").slice(0, 6)}`, ...a };
      return { rows: [{ teamId: a.teamId, ...(await propose("create_task", payload, a)) }], sources: [], cypher: [] };
    },
  }),
  deals_at_risk: def({
    description: "Open deals in a decision's ripple: amount, stage, and the verbatim PROMISED quote (what Sales told the customer). Restricted to Sales: other viewers get a count.",
    input: z.object({ decisionId: z.string().describe("Decision id, e.g. d-1") }),
    templates: ["deals-at-risk"],
    run: async ({ g }, { decisionId }) => {
      if (!(await decisions(g)).data.some((d) => d.id === decisionId)) return { rows: await unknownDecision(g, decisionId), sources: [], cypher: [] };
      const c = load("deals-at-risk");
      const rows = await roQuery<Row & { src: string | null; quote: string | null }>(g, c.text, { id: decisionId });
      return { rows: rows.length ? rows : [{ found: false, note: `No open deal promised a system decision ${decisionId} touches.` }], sources: dedupe(rows.flatMap((r) => (r.src && r.quote ? [{ artifactId: r.src, quote: r.quote }] : []))), cypher: [c] };
    },
  }),
  customer_usage: def({
    description: "Customers that use the systems a decision touches, ranked by usage (calls in the last 30 days, last seen) then ARR. ARR is only shown to Sales.",
    input: z.object({ decisionId: z.string().describe("Decision id, e.g. d-1") }),
    templates: ["customer-usage", "artifact-text"],
    run: async ({ g, now }, { decisionId }) => {
      const known = (await decisions(g)).data;
      if (!known.some((d) => d.id === decisionId)) return { rows: await unknownDecision(g, decisionId), sources: [], cypher: [] };
      const c = load("customer-usage");
      const rows = await roQuery<Row & { src: string | null }>(g, c.text, { id: decisionId });
      if (!rows.length) return { rows: [{ found: false, note: `No customer is recorded as using a system decision ${decisionId} touches.` }], sources: [], cypher: [c] };
      const s = await sourcesFor(g, rows.flatMap((r) => (r.src ? [r.src] : [])));
      return { rows: rows.map(({ src: _s, ...r }) => (void _s, { ...r, stale: typeof r.lastSeen !== "number" || r.lastSeen < now - STALE_DAYS * 86400 })), sources: s.sources, cypher: [c, s.cypher] };
    },
  }),
  access_gap: def({
    description: "For a change: the people in the affected teams who lack software or an access group its systems REQUIRE. status missing = fresh identity data and not held; unknown = identity data older than 90 days or none, so do not request on it. Also returns the change's date and sentence for the justification.",
    input: z.object({ decisionId: z.string().describe("Decision id, e.g. d-1") }),
    templates: ["ripple", "access-gap", "access-change", "artifact-text"],
    run: async ({ g, now }, { decisionId }) => {
      const a = await accessGap(g, now, decisionId);
      if (!a) return { rows: await unknownDecision(g, decisionId), sources: [], cypher: [] };
      const s = await sourcesFor(g, a.change?.src ? [a.change.src] : []);
      if (!a.checked) return { rows: [{ found: false, note: `No system decision ${decisionId} touches REQUIRES software or an access group, or no one in the affected teams was found.` }], sources: s.sources, cypher: [...a.cypher, s.cypher] };
      const rows: Row[] = [{ change: a.change, checked: a.checked, missing: a.gaps.filter((x) => x.status === "missing").length, unknown: a.gaps.filter((x) => x.status === "unknown").length }, ...a.gaps];
      return { rows, sources: dedupe([...(a.change?.src && a.change.quote ? [{ artifactId: a.change.src, quote: a.change.quote }] : []), ...s.sources]), cypher: [...a.cypher, s.cypher] };
    },
  }),
  propose_customer_draft: def({
    description: "Propose a draft customer email or a talk track for Sales or CS to review. It is saved as a pending draft_doc that a person approves; nothing is sent to the customer.",
    input: z.object({
      kind: z.enum(["email", "talk_track"]),
      customerId: z.string().describe("Customer id, e.g. cust-3"),
      decisionId: z.string().describe("Decision id the draft responds to, e.g. d-1"),
      title: z.string().min(1),
      body: z.string().min(1).describe("The full draft text"),
    }),
    templates: [],
    proposes: "draft_doc",
    run: async ({ readonly, propose }, args) => {
      if (readonly) throw new Error("demo_readonly");
      if (!propose) return { rows: [{ proposed: false, reason: "approvals_unavailable" }], sources: [], cypher: [] };
      return { rows: [{ ...(await propose("draft_doc", args, args)) }], sources: [], cypher: [] };
    },
  }),
  propose_access_request: def({
    description: "Propose that IT grants one person one required software or access group for a change. Only a person returned as missing by access_gap is accepted. Expiry defaults to 90 days. The justification quote and the approvers (system owner and IT) are filled in for you. A person approves it; Ripple never grants access itself.",
    input: z.object({
      decisionId: z.string().describe("Decision id, e.g. d-1"),
      personId: z.string().describe("Person id from access_gap"),
      resourceId: z.string().describe("resourceId from access_gap, e.g. group:v2-console"),
      justification: z.string().min(1).describe("One sentence: why this person needs it for the change"),
      expiryDays: z.number().int().min(1).max(365).optional().describe("Days until the access expires (default 90)"),
    }),
    templates: ["access-gap", "access-change", "access-resource"],
    proposes: "access_request",
    run: async ({ g, now, readonly, propose }, a) => {
      if (readonly) throw new Error("demo_readonly");
      if (!propose) return { rows: [{ proposed: false, reason: "approvals_unavailable" }], sources: [], cypher: [] };
      const gap = await accessGap(g, now, a.decisionId);
      const hit = gap?.gaps.find((x) => x.personId === a.personId && x.resourceId === a.resourceId);
      if (!gap || !hit) return { rows: [{ proposed: false, reason: "not_a_gap", note: `${a.personId} is not recorded as lacking ${a.resourceId} for ${a.decisionId}. Only access_gap rows can be requested.` }], sources: [], cypher: [] };
      if (hit.status !== "missing") return { rows: [{ proposed: false, reason: "identity_data_stale", note: `${a.personId}'s identity data is older than ${STALE_DAYS} days, so ${a.resourceId} is unknown, not missing.` }], sources: [], cypher: [] };
      const rc = load("access-resource");
      const [res] = await roQuery<{ owners: string[] }>(g, rc.text, { person: a.personId, resource: a.resourceId });
      const payload = {
        id: `ar-${a.decisionId}-${a.personId}-${a.resourceId}`, personId: a.personId, teamId: hit.teamId, resourceId: a.resourceId, resourceKind: hit.resourceKind,
        decisionId: a.decisionId, justification: a.justification, src: gap.change?.src ?? null, quote: gap.change?.quote ?? null,
        expiresAt: now + (a.expiryDays ?? 90) * 86400, approvers: [...new Set([...(res?.owners ?? []), "it"])],
      };
      return { rows: [{ teamId: hit.teamId, personId: a.personId, resourceId: a.resourceId, ...(await propose("access_request", payload, { change: gap.change, gap: hit })) }], sources: [], cypher: [rc] };
    },
  }),
  // ---- team specialists (#189): Docs, Security, Support, Decision Advisor ----
  docs_pages: def({
    description: "Docs pages that describe the sunset system (path, 30-day views, thumbs-down) for a decision, most viewed first, with the source of the sunset. Coarse: the graph has no page-to-system edge, so these are the pages flagged as v1 docs.",
    input: z.object({ decisionId: z.string().describe("Decision id, e.g. d-1") }),
    templates: ["docs-pages", "artifact-text"],
    run: async ({ g }, { decisionId }) => {
      const c = load("docs-pages");
      const rows = await roQuery<{ src: string | null }>(g, c.text, { id: decisionId });
      if (!rows.length) return { rows: await unknownDecision(g, decisionId), sources: [], cypher: [c] };
      const s = await sourcesFor(g, rows.flatMap((r) => (r.src ? [r.src] : [])));
      return { rows: rows as Row[], sources: s.sources, cypher: [c, s.cypher] };
    },
  }),
  affected_controls: def({
    description: "Security controls (SOC 2 / ISO 27001) and open findings tied to a decision: control status and audit-blocking flag, finding severity, status and SLA. Restricted to Security: other viewers get counts only. Coarse for controls (no control-to-system edge): the v1-related controls.",
    input: z.object({ decisionId: z.string().describe("Decision id, e.g. d-1") }),
    templates: ["controls-affected", "findings-affected", "artifact-text"],
    run: async ({ g }, { decisionId }) => {
      const cc = load("controls-affected");
      const fc = load("findings-affected");
      const [controls, findings] = await Promise.all([roQuery<Row>(g, cc.text, { id: decisionId }), roQuery<{ src: string | null }>(g, fc.text, { id: decisionId })]);
      if (!controls.length && !findings.length) return { rows: await unknownDecision(g, decisionId), sources: [], cypher: [cc, fc] };
      const s = await sourcesFor(g, findings.flatMap((r) => (r.src ? [r.src] : [])));
      return { rows: [...controls, ...findings] as Row[], sources: s.sources, cypher: [cc, fc, s.cypher] };
    },
  }),
  affected_tickets: def({
    description: "Open tickets about the system a decision sunsets (or systems that depend on it), with the customer who raised each. Quotes come from the ticket text. Customer ARR is never included.",
    input: z.object({ decisionId: z.string().describe("Decision id, e.g. d-1") }),
    templates: ["support-tickets", "artifact-text"],
    run: async ({ g }, { decisionId }) => {
      const c = load("support-tickets");
      const rows = await roQuery<{ id: string }>(g, c.text, { id: decisionId });
      if (!rows.length) return { rows: await unknownDecision(g, decisionId), sources: [], cypher: [c] };
      const s = await sourcesFor(g, rows.map((r) => r.id));
      return { rows: rows as Row[], sources: s.sources, cypher: [c, s.cypher] };
    },
  }),
  decision_costs: def({
    description: "What each way out of a contract conflict costs, from the graph: ARR at risk, the customers behind the conflicting contracts and how long their guarantees run, teams to involve, open tasks, open deals. ARR shows as null to viewers who may not see it.",
    input: z.object({ decisionId: z.string().describe("Decision id, e.g. d-1") }),
    templates: ["decision", "ripple", "conflicts-list", "decision-costs", "open-tasks-by-team"],
    run: async ({ g, now }, { decisionId }) => {
      const r = await ripple(g, decisionId, now).catch((e) => (e instanceof NotFound ? null : Promise.reject(e)));
      if (!r) return { rows: await unknownDecision(g, decisionId), sources: [], cypher: [] };
      const cc = load("decision-costs");
      const tc = load("open-tasks-by-team");
      const teams = r.teams.map((t) => t.teamId);
      const [customers, tasks] = await Promise.all([
        roQuery<Row>(g, cc.text, { id: decisionId, ids: r.conflicts.flatMap((c) => c.contractIds) }),
        roQuery<{ open: number }>(g, tc.text, { teams }),
      ]);
      const rows: Row[] = [{
        decision: r.decision, counts: r.counts, teams, conflicts: r.conflicts.map((c) => ({ id: c.id, severity: c.severity, contractIds: c.contractIds })),
        contractCustomers: customers, openTasksByTeam: tasks, openTasks: tasks.reduce((n, t) => n + t.open, 0),
      }];
      return { rows, sources: dedupe(r.conflicts.flatMap((c) => c.sources)), cypher: [...r.cypher, cc, tc] };
    },
  }),
  propose_doc: def({
    description: "Propose a draft document for a team to review: a docs change or banner, an FAQ, a support reply macro, or a security audit-impact note. It is saved as a pending draft_doc that a person approves; nothing is published or sent.",
    input: z.object({
      kind: z.enum(["docs_change", "faq", "reply_macro", "audit_note"]),
      decisionId: z.string().describe("Decision id the draft responds to, e.g. d-1"),
      pageId: z.string().nullable().describe("Docs page id the draft changes, e.g. pg-1, or null"),
      title: z.string().min(1),
      body: z.string().min(1).describe("The full draft text, citing [[artifact-id]] for each claim"),
    }),
    templates: [],
    proposes: "draft_doc",
    run: async ({ readonly, propose }, args) => {
      if (readonly) throw new Error("demo_readonly");
      if (!propose) return { rows: [{ proposed: false, reason: "approvals_unavailable" }], sources: [], cypher: [] };
      return { rows: [{ ...(await propose("draft_doc", args, args)) }], sources: [], cypher: [] };
    },
  }),
  create_tasks: def({
    description: "Propose one open Task (with a NOTIFIES edge) for every team the decision never reached. A person approves each proposal before it is created. Without an approver it only reports what it would create.",
    input: z.object({ decisionId: z.string().describe("Decision id, e.g. d-1") }),
    templates: ["ripple", "gap"],
    proposes: "create_task",
    run: async ({ g, now, readonly, propose }, { decisionId }) => {
      if (readonly) throw new Error("demo_readonly");
      const r = await ripple(g, decisionId, now);
      const rows = r.gap.map((teamId) => ({ teamId, payload: { id: `task-${decisionId}-${teamId}`, teamId, decisionId, title: `Review: ${r.decision.title}`, body: claimsBody(claimsFor(r, teamId)) } }));
      if (!propose) { // no approver (no Postgres): describe, never write
        const c = load("task-preview");
        const prev = rows.length ? await roQuery<{ teamId: string; owner: string | null; dueAt: number }>(g, c.text, { rows: rows.map((x) => ({ teamId: x.teamId, decisionId })), now }) : [];
        const wouldCreate = rows.map(({ teamId, payload }) => ({ teamId, title: payload.title, owner: prev.find((p) => p.teamId === teamId)?.owner ?? null, dueAt: prev.find((p) => p.teamId === teamId)?.dueAt ?? null }));
        return { rows: [{ proposed: false, reason: "approvals_unavailable", wouldCreate }], sources: [], cypher: [c] };
      }
      const out = await Promise.all(rows.map(async ({ teamId, payload }) => ({ teamId, ...(await propose("create_task", payload, claimsFor(r, teamId))) })));
      return { rows: out as Row[], sources: [], cypher: [] };
    },
  }),
  list_decisions: def({
    description: "Every decision (id, title, status), oldest first. Start here to find a decision id like d-1.",
    input: z.object({}),
    templates: ["decisions"],
    run: async ({ g }) => {
      const d = await decisions(g);
      return { rows: d.data, sources: [], cypher: d.cypher };
    },
  }),
  list_agents: def({
    description: "The agents run_agent can run: name, what it does, who it serves, whether it would write (then run_agent returns proposal previews only) and its input shape.",
    input: z.object({}),
    templates: [],
    run: async () => (await import("./handoff")).listAgents(),
  }),
  run_agent: def({
    description: "Run another Ripple agent now, as you, and return its report with its sources. Read-only: an agent that would write returns its proposals as previews; nothing is created or sent. Call list_agents first for names and input shapes.",
    input: z.object({ name: z.string().describe("Agent name from list_agents, e.g. contract"), input: z.record(z.string(), z.unknown()).describe("The agent's input object, as list_agents shows") }),
    templates: [],
    run: async (ctx, { name, input }) => (await import("./handoff")).runInline(ctx, name, input),
  }),
};
export type ToolName = keyof typeof TOOLS;
/** Every tool that cannot cause a side effect: what a read-only agent (Ask) may use. */
export const READ_TOOLS = (Object.keys(TOOLS) as ToolName[]).filter((n) => !TOOLS[n].proposes);

export const cypherText = (cs: { name: string; text: string }[]) => cs.map((c) => `// ${c.name}\n${c.text}`).join("\n");
export const templateText = (names: string[]) => cypherText(names.map(load));

/** Tool output as untrusted data. A literal "</data" in the payload cannot close the wrapper. */
export const wrapData = (name: string, rows: unknown, sourceIds: string[]) =>
  `<data source="tool:${name}">${JSON.stringify({ rows, sourceIds }).replaceAll("</data", "<\\/data")}</data>`;
