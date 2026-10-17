// Ripple as an MCP server: the agent TOOLS plus a few thin decision tools, one JSON text block per call.
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { TOOLS, type Ctx, type Row, type ToolOut } from "../agent/tools";
import { roQuery } from "../graph/client";
import { decisions, load, ripple } from "../graph/queries";
import { recordAck } from "../notify";
import { redactToolOut } from "../permissions/redact";
import type { Context } from "../server/context";
import type { Source } from "../schemas";

const decisionId = z.string().describe("Decision id, e.g. d-1 (call list_decisions to discover ids)");
const dedupe = (xs: Source[]) => [...new Map(xs.map((s) => [`${s.artifactId}|${s.quote}`, s])).values()];

type Tool = { description: string; input: z.ZodObject; write?: boolean; run: (args: never) => Promise<ToolOut> };
type Id = { decisionId: string };

export function createRippleServer(ctx: Ctx, audit?: Context["audit"]): McpServer {
  const server = new McpServer({ name: "ripple", version: "0.1.0" });
  const { g, now } = ctx;

  const tools: Record<string, Tool> = {
    list_decisions: {
      description: "List every decision (id, title, status). Start here to find a decision id like d-1 for the other tools.",
      input: z.object({}),
      run: async () => {
        const d = await decisions(g);
        return { rows: d.data, sources: [], cypher: d.cypher };
      },
    },
    search: { ...TOOLS.search, run: (args: never) => TOOLS.search.run(ctx, args) },
    ripple_impact: {
      description: `${TOOLS.ripple.description} Counts include customers, tickets, deals, contracts and ARR at risk. Optional depth (1..4) is the dependency hop limit.`,
      input: TOOLS.ripple.input.extend({ depth: z.number().int().min(1).max(4).optional().describe("Dependency hops to follow (default 3)") }),
      run: (args: never) => TOOLS.ripple.run(ctx, args),
    },
    who_knows: { ...TOOLS.who_knows, run: (args: never) => TOOLS.who_knows.run(ctx, args) },
    trace_decision: { ...TOOLS.trace_decision, run: (args: never) => TOOLS.trace_decision.run(ctx, args) },
    bottleneck: { ...TOOLS.bottleneck, run: (args: never) => TOOLS.bottleneck.run(ctx, args) },
    why_affected: { ...TOOLS.why_affected, run: (args: never) => TOOLS.why_affected.run(ctx, args) },
    who_wasnt_told: {
      description: "Teams affected by a decision that were never involved in it nor acknowledged it (the gap), with why each is affected and the evidence.",
      input: z.object({ decisionId }),
      run: async ({ decisionId: id }: Id) => {
        const r = await ripple(g, id, now);
        const gap = r.teams.filter((t) => r.gap.includes(t.teamId));
        const rows: Row[] = gap.map((t) => ({ teamId: t.teamId, why: t.why.map((w) => w.reason) }));
        return { rows, sources: dedupe(gap.flatMap((t) => t.why.map((w) => w.source))), cypher: r.cypher };
      },
    },
    check_contract_conflict: {
      description: "Contract conflicts for a decision (e.g. a sunset vs. an availability guarantee): contract ids, severity, and the verbatim clause quotes as sources.",
      input: z.object({ decisionId }),
      run: async ({ decisionId: id }: Id) => {
        const r = await ripple(g, id, now);
        const rows: Row[] = r.conflicts.map((c) => ({ id: c.id, kind: c.kind, severity: c.severity, contractIds: c.contractIds }));
        return { rows, sources: dedupe(r.conflicts.flatMap((c) => c.sources)), cypher: r.cypher };
      },
    },
    deals_at_risk: {
      description: "Open deals in a decision's ripple: amount, stage, and the verbatim PROMISED quote (what sales told the customer).",
      input: z.object({ decisionId }),
      run: async ({ decisionId: id }: Id) => {
        await ripple(g, id, now); // throws NotFound for an unknown decision
        const c = load("deals-at-risk");
        const rows = await roQuery<Row & { src: string | null; quote: string | null }>(g, c.text, { id });
        return { rows, sources: dedupe(rows.flatMap((r) => (r.src && r.quote ? [{ artifactId: r.src, quote: r.quote }] : []))), cypher: [c] };
      },
    },
    affected_controls: {
      description: "Security Controls (SOC 2 / ISO 27001) likely affected by a decision. The graph has no Control-to-System edge, so this returns the v1-related controls (the API v1 surface) whenever the decision sunsets a system; treat it as a coarse pointer, not a proven link.",
      input: z.object({ decisionId }),
      run: async ({ decisionId: id }: Id) => {
        await ripple(g, id, now);
        const c = load("controls-affected");
        return { rows: await roQuery<Row>(g, c.text, { id }), sources: [], cypher: [c] };
      },
    },
    list_agents: { ...TOOLS.list_agents, run: (args: never) => TOOLS.list_agents.run(ctx, args) },
    run_agent: { ...TOOLS.run_agent, run: (args: never) => TOOLS.run_agent.run(ctx, args) }, // read-only; an agent that would write returns previews
    ack_brief: {
      description: "WRITES to the graph (demo, or an API key whose user is admin / change_owner): record that a team acknowledged a decision, which removes it from the gap. Use only when the user asked to acknowledge.",
      input: z.object({ decisionId, teamId: z.string().describe("Team id, e.g. legal"), kind: z.enum(["seen", "concern", "not_relevant"]).default("seen") }),
      write: true,
      run: async ({ decisionId: id, teamId, kind }: Id & { teamId: string; kind: "seen" | "concern" | "not_relevant" }) => {
        if (ctx.readonly) throw new Error("demo_readonly");
        if (!ctx.demo && !["admin", "change_owner"].includes(ctx.viewer?.role ?? "")) throw new Error("forbidden: ack_brief needs the admin or change_owner role");
        const r = await ripple(g, id, now);
        if (!r.teams.some((t) => t.teamId === teamId)) throw new Error(`team ${teamId} is not affected by ${id}`);
        const ack = await recordAck(g, { teamId, decisionId: id, kind }, now);
        return { rows: [{ decisionId: id, teamId, kind, by: ack.by, gap: ack.gap }], sources: [], cypher: [] };
      },
    },
  };

  for (const [name, t] of Object.entries(tools)) {
    server.registerTool(
      name,
      { description: t.description, inputSchema: t.input, annotations: t.write ? { readOnlyHint: false, destructiveHint: true } : { readOnlyHint: true } },
      async (args: unknown): Promise<CallToolResult> => {
        const t0 = Date.now();
        try {
          const out = await redactToolOut(g, ctx.viewer, await t.run(args as never)); // every MCP tool, before JSON.stringify
          const ev = { action: "mcp.tool", resourceType: "tool", resourceId: name, read: !t.write };
          if (t.write) await audit?.(ev); else void audit?.(ev); // tool name only, never the payload
          const body = { ...out, trace: { tool: name, args, ms: Date.now() - t0, rows: out.rows.length } };
          return { content: [{ type: "text", text: JSON.stringify(body) }], structuredContent: body };
        } catch (e) {
          if (e instanceof Error && (e.message === "demo_readonly" || e.message.startsWith("forbidden"))) await audit?.({ action: "mcp.tool", resourceType: "tool", resourceId: name, outcome: "deny" });
          return { isError: true, content: [{ type: "text", text: JSON.stringify({ error: e instanceof Error ? e.message : String(e) }) }] };
        }
      },
    );
  }
  return server;
}
