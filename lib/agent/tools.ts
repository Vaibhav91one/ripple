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
export type Ctx = { g: Graph; now: number; demo: boolean; /** Anonymous demo viewer: write tools throw "demo_readonly". */ readonly?: boolean; viewer?: Viewer } & Partial<Omit<RunCtx, "viewer">>;
type Def<I extends z.ZodType> = {
  description: string;
  input: I;
  /** Template names, shown to the user in the tool_call event before the tool runs. */
  templates: string[];
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
    run: async ({ readonly, propose }, a) => {
      if (readonly) throw new Error("demo_readonly");
      if (!propose) return { rows: [{ proposed: false, reason: "approvals_unavailable" }], sources: [], cypher: [] };
      const payload = { id: `task-${a.decisionId}-${a.teamId}-${createHash("sha1").update(a.title).digest("hex").slice(0, 6)}`, ...a };
      return { rows: [{ teamId: a.teamId, ...(await propose("create_task", payload, a)) }], sources: [], cypher: [] };
    },
  }),
  create_tasks: def({
    description: "Propose one open Task (with a NOTIFIES edge) for every team the decision never reached. A person approves each proposal before it is created. Without an approver it only reports what it would create.",
    input: z.object({ decisionId: z.string().describe("Decision id, e.g. d-1") }),
    templates: ["ripple", "gap"],
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
};
export type ToolName = keyof typeof TOOLS;

export const cypherText = (cs: { name: string; text: string }[]) => cs.map((c) => `// ${c.name}\n${c.text}`).join("\n");
export const templateText = (names: string[]) => cypherText(names.map(load));

/** Tool output as untrusted data. A literal "</data" in the payload cannot close the wrapper. */
export const wrapData = (name: string, rows: unknown, sourceIds: string[]) =>
  `<data source="tool:${name}">${JSON.stringify({ rows, sourceIds }).replaceAll("</data", "<\\/data")}</data>`;
