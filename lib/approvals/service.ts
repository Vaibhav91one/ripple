// Reads and writes behind /approvals and /agents. Postgres only; the routes decide what the viewer may see.
import "server-only";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "../db";
import { agentRuns, agentSettings, orgPolicy, pendingActions, runSteps } from "../db/schema";
import { approve, reject, type DecideCtx } from "../actions/decide";
import { OWNER_ROLE } from "../actions/executors";
import { ACTION_KINDS, type ActionKind } from "../agent/define";
import { agents } from "../agent/registry";
import type { AgentInfo, ApprovalRow, RunDetail, RunSummary } from "../schemas/approvals";
import { summarize } from "./format";

type Viewer = DecideCtx["viewer"];
const iso = (d: Date | null) => (d ? d.toISOString() : null);
const isKind = (k: string): k is ActionKind => (ACTION_KINDS as readonly string[]).includes(k);

export const canDecideKind = (v: Viewer, kind: string) =>
  v.kind === "user" && (v.role === "admin" || (isKind(kind) && v.role === OWNER_ROLE[kind]));

type Joined = { a: typeof pendingActions.$inferSelect; agent: string | null };
function toRow({ a, agent }: Joined, v: Viewer): Omit<ApprovalRow, "groupSize"> {
  const s = summarize(a.kind, a.payload, a.evidence, agent);
  return {
    id: a.id, kind: a.kind, status: a.status, summary: s.summary, subject: s.subject, fields: s.fields, evidence: s.evidence, proposer: s.proposer,
    runId: a.runId, changeId: s.changeId, group: s.group, requestedAt: a.requestedAt.toISOString(), decidedAt: iso(a.decidedAt),
    approver: a.approver, error: a.error, canDecide: canDecideKind(v, a.kind) && (a.status === "pending" || a.status === "failed"), question: s.question,
  };
}

/** "open" = pending + failed (still needs a person); "decided" = the rest, newest first. Users see the kinds their role decides; the anonymous demo sees all, read-only. */
export async function listApprovals(orgId: string, v: Viewer, scope: "open" | "decided" = "open"): Promise<{ rows: ApprovalRow[]; open: number }> {
  const d = db();
  const kinds = v.kind === "user" && v.role !== "admin" ? ACTION_KINDS.filter((k) => OWNER_ROLE[k] === v.role) : undefined;
  if (kinds && !kinds.length) return { rows: [], open: 0 };
  const open = ["pending", "failed"] as const;
  const where = and(
    eq(pendingActions.orgId, orgId),
    kinds && inArray(pendingActions.kind, kinds),
    scope === "open" ? inArray(pendingActions.status, open) : sql`${pendingActions.status} not in ('pending','failed')`,
  );
  const found = await d.select({ a: pendingActions, agent: agentRuns.agent }).from(pendingActions)
    .leftJoin(agentRuns, eq(agentRuns.id, pendingActions.runId)).where(where)
    .orderBy(scope === "open" ? pendingActions.requestedAt : desc(pendingActions.decidedAt)).limit(300);
  const rows = found.map((j) => toRow(j, v));
  const size = new Map<string, number>();
  for (const r of rows) if (r.group) size.set(`${r.kind}\0${r.group}`, (size.get(`${r.kind}\0${r.group}`) ?? 0) + 1);
  const [{ n }] = await d.select({ n: sql<number>`count(*)::int` }).from(pendingActions)
    .where(and(eq(pendingActions.orgId, orgId), kinds && inArray(pendingActions.kind, kinds), inArray(pendingActions.status, open)));
  return { rows: rows.map((r) => ({ ...r, groupSize: r.group ? size.get(`${r.kind}\0${r.group}`) ?? 1 : 1 })), open: n };
}

/** Approve or reject one action; with `bulk`, every pending action of the same kind and group in this org. Each goes through lib/actions/decide (role check, audit, status guard). */
export async function decideMany(ctx: DecideCtx, id: string, verb: "approve" | "reject", opts: { bulk?: boolean; note?: string } = {}) {
  const run = verb === "approve" ? approve : reject;
  const ids = [id];
  if (opts.bulk) {
    const [one] = await db().select().from(pendingActions).where(and(eq(pendingActions.id, id), eq(pendingActions.orgId, ctx.org.id)));
    const g = one && summarize(one.kind, one.payload, one.evidence, null).group;
    if (g) {
      const sibs = await db().select().from(pendingActions).where(and(eq(pendingActions.orgId, ctx.org.id), eq(pendingActions.kind, one.kind), eq(pendingActions.status, "pending")));
      ids.push(...sibs.filter((s) => s.id !== id && summarize(s.kind, s.payload, s.evidence, null).group === g).map((s) => s.id));
    }
  }
  const results = [];
  for (const i of ids) results.push(await run(ctx, i)); // the first throws ActionError for 404/403; a bulk that begins allowed stays allowed (same kind)
  return results;
}

/** `orgId` null = no Postgres: the registry alone, everything on, nothing auto-approved. */
export async function listAgents(orgId: string | null): Promise<AgentInfo[]> {
  const d = orgId ? db() : undefined;
  const [settings, policy, last, counts] = !d || !orgId ? [[], [], [], []] as const : await Promise.all([
    d.select().from(agentSettings).where(eq(agentSettings.orgId, orgId)),
    d.select().from(orgPolicy).where(eq(orgPolicy.orgId, orgId)),
    d.selectDistinctOn([agentRuns.agent], { id: agentRuns.id, agent: agentRuns.agent, status: agentRuns.status, startedAt: agentRuns.startedAt })
      .from(agentRuns).where(eq(agentRuns.orgId, orgId)).orderBy(agentRuns.agent, desc(agentRuns.startedAt)),
    d.select({ agent: agentRuns.agent, n: sql<number>`count(*)::int` }).from(agentRuns)
      .where(and(eq(agentRuns.orgId, orgId), sql`${agentRuns.startedAt} > now() - interval '24 hours'`)).groupBy(agentRuns.agent),
  ]);
  return agents().map((a) => {
    const l = last.find((r) => r.agent === a.name);
    return {
      name: a.name, displayName: a.displayName, tagline: a.tagline, group: a.group, job: jobOf(a), team: a.team, triggers: triggersOf(a.trigger), tools: [...a.tools], writes: [...a.writes],
      enabled: settings.find((s) => s.agent === a.name)?.enabled ?? true,
      autoApprove: Object.fromEntries(a.writes.map((k) => [k, policy.find((p) => p.actionKind === k)?.autoApprove ?? false])),
      lastRun: l ? { id: l.id, status: l.status, startedAt: l.startedAt.toISOString() } : null,
      runs24h: counts.find((c) => c.agent === a.name)?.n ?? 0,
    };
  });
}

/** First sentence of the system prompt, unless the definition carries a description (#186). */
function jobOf(a: ReturnType<typeof agents>[number]) {
  const text = (a as { description?: string }).description ?? a.system({ now: 0 });
  const line = text.replace(/\s+/g, " ").trim();
  const cut = line.search(/[.!?](\s|$)/);
  return (cut > 0 ? line.slice(0, cut + 1) : line).slice(0, 180);
}
const triggersOf = (t: { events?: string[]; cron?: string }) => [...(t.events ?? []), ...(t.cron ? [`cron ${t.cron}`] : [])];

export const runCols = {
  id: agentRuns.id, agent: agentRuns.agent, trigger: agentRuns.trigger, status: agentRuns.status, tokens: agentRuns.tokens,
  startedAt: agentRuns.startedAt, endedAt: agentRuns.endedAt, error: agentRuns.error,
  proposals: sql<number>`(select count(*)::int from pending_action p where p.run_id = "agent_run"."id")`,
};
type RunRow = { id: string; agent: string; trigger: string; status: string; tokens: number; startedAt: Date; endedAt: Date | null; error: string | null; proposals: number };
const toRun = (r: RunRow): RunSummary => ({
  id: r.id, agent: r.agent, trigger: r.trigger, status: r.status, tokens: r.tokens, startedAt: r.startedAt.toISOString(),
  durationMs: r.endedAt ? r.endedAt.getTime() - r.startedAt.getTime() : null, proposals: r.proposals, error: r.error,
});

export async function listRuns(orgId: string, agent?: string): Promise<RunSummary[]> {
  const rows = await db().select(runCols).from(agentRuns)
    .where(and(eq(agentRuns.orgId, orgId), agent ? eq(agentRuns.agent, agent) : undefined)).orderBy(desc(agentRuns.startedAt)).limit(50);
  return rows.map(toRun);
}

export async function getRun(orgId: string, id: string, v: Viewer): Promise<RunDetail | null> {
  const d = db();
  const [r] = await d.select({ ...runCols, input: agentRuns.input, output: agentRuns.output }).from(agentRuns).where(and(eq(agentRuns.id, id), eq(agentRuns.orgId, orgId)));
  if (!r) return null;
  const [steps, props] = await Promise.all([
    d.select().from(runSteps).where(eq(runSteps.runId, id)).orderBy(runSteps.n),
    d.select({ a: pendingActions, agent: sql<string | null>`null` }).from(pendingActions).where(and(eq(pendingActions.runId, id), eq(pendingActions.orgId, orgId))).orderBy(pendingActions.requestedAt),
  ]);
  return {
    run: { ...toRun(r), input: r.input, output: r.output },
    steps: steps.map((s) => ({ n: s.n, kind: s.kind, tool: s.tool, args: s.args, cypher: s.cypher, sources: s.sourceIds, tokens: s.tokens, durationMs: s.durationMs, rowCount: s.rowCount })),
    proposals: props.map((p) => ({ id: p.a.id, kind: p.a.kind, status: p.a.status, summary: toRow(p, v).summary, subject: toRow(p, v).subject })),
  };
}

export async function saveSettings(orgId: string, agent: string, p: { enabled?: boolean; autoApprove?: Record<string, boolean> }) {
  const d = db();
  if (p.enabled !== undefined) await d.insert(agentSettings).values({ orgId, agent, enabled: p.enabled }).onConflictDoUpdate({ target: [agentSettings.orgId, agentSettings.agent], set: { enabled: p.enabled } });
  for (const [actionKind, autoApprove] of Object.entries(p.autoApprove ?? {}))
    await d.insert(orgPolicy).values({ orgId, actionKind, autoApprove }).onConflictDoUpdate({ target: [orgPolicy.orgId, orgPolicy.actionKind], set: { autoApprove } });
}
