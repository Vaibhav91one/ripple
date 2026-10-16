// Agent tools = the Cypher templates. The model picks a tool and fills params; it never writes Cypher.
import { z } from "zod";
import { query, type Graph } from "../graph/client";
import { bottleneck, load, ripple, search, whoKnows, type Cypher } from "../graph/queries";
import type { Source } from "../schemas";

export type Row = Record<string, unknown>;
export type ToolOut = { rows: Row[]; sources: Source[]; cypher: Cypher[] };
export type Ctx = { g: Graph; now: number; demo: boolean };
type Def<I extends z.ZodType> = {
  description: string;
  input: I;
  /** Template names, shown to the user in the tool_call event before the tool runs. */
  templates: string[];
  run: (ctx: Ctx, args: z.infer<I>) => Promise<ToolOut>;
};
const def = <I extends z.ZodType>(d: Def<I>) => d;

const QUOTE_LEN = 160;
/** Sources for artifact ids, quoting the start of the artifact text (always a verbatim substring). */
async function sourcesFor(g: Graph, ids: string[]): Promise<{ sources: Source[]; cypher: Cypher }> {
  const c = load("artifact-text");
  const rows = await query<{ id: string; text: string | null }>(g, c.text, { ids: [...new Set(ids)] });
  const sources = rows.flatMap((r) => (r.text?.trim() ? [{ artifactId: r.id, quote: r.text.trim().slice(0, QUOTE_LEN) }] : []));
  return { sources, cypher: c };
}
const dedupe = (xs: Source[]) => [...new Map(xs.map((s) => [s.artifactId, s])).values()];

export const TOOLS = {
  search: def({
    description: "Full-text search over documents, tickets, messages and PRs. Use for open-ended questions.",
    input: z.object({ text: z.string().min(1).describe("Search words") }),
    templates: ["search", "artifact-text"],
    run: async ({ g }, { text }) => {
      const hits = await search(g, text);
      const s = await sourcesFor(g, hits.data.map((h) => h.id));
      return { rows: hits.data, sources: s.sources, cypher: [...hits.cypher, s.cypher] };
    },
  }),
  ripple: def({
    description: "Everything a decision touches: affected teams, which were never told (gap), conflicts, customers and ARR at risk.",
    input: z.object({ decisionId: z.string().describe("Decision id, e.g. d-1") }),
    templates: ["decision", "ripple", "gap", "conflicts-detect"],
    run: async ({ g, now }, { decisionId }) => {
      const r = await ripple(g, decisionId, now);
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
      const [d] = await query<{ id: string; title: string; status: string; src: string | null; quote: string | null }>(g, dc.text, { id: decisionId });
      if (!d) throw new Error(`unknown decision ${decisionId}`);
      const sup = await query<{ sourceId: string | null; sourceTitle: string | null; quote: string | null }>(g, tc.text, { id: decisionId });
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
  create_tasks: def({
    description: "Create one open Task (with a NOTIFIES edge) for every team the decision never reached. Writes to the graph; demo only.",
    input: z.object({ decisionId: z.string().describe("Decision id, e.g. d-1") }),
    templates: ["ripple", "gap", "create-tasks"],
    run: async ({ g, now, demo }, { decisionId }) => {
      if (!demo) throw new Error("create_tasks only runs on the demo graph");
      const r = await ripple(g, decisionId, now);
      const c = load("create-tasks");
      const rows = r.gap.map((teamId) => ({ id: `task-${decisionId}-${teamId}`, teamId, title: `Review: ${r.decision.title}` }));
      const created = rows.length ? await query(g, c.text, { rows, now }) : [];
      return { rows: created as Row[], sources: [], cypher: [c] };
    },
  }),
};
export type ToolName = keyof typeof TOOLS;

export const cypherText = (cs: { name: string; text: string }[]) => cs.map((c) => `// ${c.name}\n${c.text}`).join("\n");
export const templateText = (names: string[]) => cypherText(names.map(load));
