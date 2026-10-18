// Server side of GET /api/reports, /api/reports/[id] and /api/activity: one case file per change, computed from the graph
// (ripple, gap, conflicts, ACKED edges) and merged with the Postgres event log when there is one. Redaction happens in handle().
import { z } from "zod";
import { roQuery, type Graph } from "./graph/client";
import { decisions, load, names, NotFound, ripple } from "./graph/queries";
import { dbEvents, isCase, loadRows, type Rows } from "./reports-db";
import { demoEvents, DEMO_CUSTOMERS_NOTIFIED } from "./reports-demo";
import type { RippleResult } from "./schemas";
import type { Activity, ReportDetail, ReportRow, TimelineEvent } from "./schemas/reports";
import type { Context } from "./server/context";

const n = z.coerce.number();
const Head = z.object({
  id: z.string(), title: z.string(), decidedAt: n, systems: z.array(z.object({ id: z.string(), name: z.string() })),
  effectiveAt: n.nullable(), src: z.string().nullable(), quote: z.string().nullable(),
});
const Ack = z.object({ kind: z.enum(["Team", "Person"]), id: z.string(), teamId: z.string().nullable(), type: z.enum(["ACKED", "INVOLVED_IN"]), at: n, ackKind: z.string().nullable() });
const Contract = z.object({ id: z.string(), name: z.string(), endsAt: n.nullable(), arr: n.nullable() });

const EXPECTED: Record<string, string> = {
  legal: "Review contracts that guarantee the system", security: "Review controls and findings on the system", devrel: "Update the docs and the migration guide",
  sales: "Acknowledge and notify customers", support: "Acknowledge and brief the ticket queue",
};

export type Case = {
  row: ReportRow; head: z.infer<typeof Head>; rip: RippleResult; acks: z.infer<typeof Ack>[];
  /** epoch second each affected team was told or acknowledged (team-level edges) */
  toldAt: Map<string, number>; nm: Map<string, string>;
};

export async function loadCase(g: Graph, id: string, now: number, nm: Map<string, string>): Promise<Case> {
  const head = Head.array().parse(await roQuery(g, load("reports-head").text, { id }))[0];
  if (!head) throw new NotFound(`unknown change ${id}`);
  const [rip, acks] = [await ripple(g, id, now), Ack.array().parse(await roQuery(g, load("reports-acks").text, { id }))];
  const toldAt = new Map<string, number>();
  for (const a of acks) if (a.kind === "Team" && (!toldAt.has(a.id) || a.at < toldAt.get(a.id)!)) toldAt.set(a.id, a.at);
  const affected = rip.counts.teamsAffected;
  const told = affected - rip.counts.notTold;
  const state = rip.counts.conflicts ? "blocked" : rip.counts.notTold ? "waiting" : "done";
  // the team to chase first: the contract owner when there is a conflict, else the first untold team
  const gapId = (rip.conflicts.length && rip.gap.includes("legal") ? "legal" : rip.gap[0]) ?? null;
  const why = gapId ? rip.teams.find((t) => t.teamId === gapId)?.why[0]?.reason : undefined;
  const row: ReportRow = {
    id, title: head.title, kind: "change", state, needsYou: state !== "done",
    systems: head.systems.filter((x) => x.id),
    announcedAt: head.decidedAt, effectiveAt: head.effectiveAt, arrAtRisk: rip.counts.arrAtRisk,
    coverage: { told, affected, pct: affected ? Math.round((100 * told) / affected) : 100 },
    mainGap: gapId ? { teamId: gapId, name: nm.get(gapId) ?? gapId, reason: `${nm.get(gapId) ?? gapId} ${why ?? "is affected"} and has not been told` } : null,
    openConflicts: rip.counts.conflicts,
  };
  return { row, head, rip, acks, toldAt, nm };
}

const nameMap = async (g: Graph) => new Map(Object.entries((await names(g)).data));
/** Non-superseded decisions, newest first. */
const openIds = async (g: Graph) => (await decisions(g)).data.filter((d) => d.status !== "superseded").map((d) => d.id).reverse();

function graphEvents(c: Case, now: number): TimelineEvent[] {
  const { head, acks, rip, nm } = c;
  const out: TimelineEvent[] = [{
    id: `ann-${head.id}`, at: head.decidedAt, kind: "announced", actor: { type: "system", id: null, name: "Ripple" }, teamId: null, text: `Announced: ${head.title}`, url: null, source: "graph", demo: false,
  }];
  for (const a of acks.filter((a) => a.type === "ACKED")) {
    const name = nm.get(a.id) ?? a.id;
    const team = a.kind === "Team" ? a.id : a.teamId;
    out.push({
      id: `ack-${a.id}-${a.at}`, at: a.at, kind: "ack", actor: { type: "person", id: a.id, name }, teamId: team,
      text: a.kind === "Team" ? `${name} acknowledged the change` : `${name} ${a.ackKind === "concern" ? "raised a concern about" : "acknowledged"} the change`, url: null, source: "graph", demo: false,
    });
  }
  for (const k of rip.conflicts) {
    out.push({ id: `conf-${k.id}`, at: Math.min(k.detectedAt, now), kind: "conflict", actor: { type: "system", id: null, name: "Ripple" }, teamId: "legal", text: `Ripple noticed the sunset conflicts with a contract guarantee (${k.severity} severity)`, url: null, source: "graph", demo: false });
  }
  return out;
}

/** Real events first; demo history only for the kinds the real log has none of, and only for the seeded demo change. */
function timelineFor(c: Case, rows: Rows | null, now: number, demo: boolean): TimelineEvent[] {
  const real = [...graphEvents(c, now), ...(rows ? dbEvents(rows, c.head.id, (id) => c.nm.get(id) ?? id) : [])];
  const have = new Set(real.map((e) => e.kind));
  const seeded = demo ? demoEvents(c.head.id, c.head.decidedAt, c.rip).filter((e) => !have.has(e.kind)) : [];
  return [...real, ...seeded].sort((a, b) => a.at - b.at || a.id.localeCompare(b.id));
}

/** Executed customer email / talk-track actions for the change: one notice per customer. */
export const noticesSent = (rows: Rows | null, id: string) =>
  rows?.pending.filter((p) => ["email", "talk_track"].includes(p.kind) && p.status === "executed" && isCase(id, p)).length ?? 0;

export async function reportList(ctx: Context) {
  const { graph: g, now } = ctx;
  const nm = await nameMap(g);
  const cases = await Promise.all((await openIds(g)).map(async (id) => (await loadCase(g, id, now, nm)).row));
  const byState = { blocked: 0, waiting: 0, done: 0 };
  for (const r of cases) byState[r.state]++;
  return { now, summary: { total: cases.length, needYou: cases.filter((r) => r.needsYou).length, byState }, cases };
}

export async function reportDetail(ctx: Context, id: string): Promise<ReportDetail> {
  const { graph: g, now } = ctx;
  const nm = await nameMap(g);
  const c = await loadCase(g, id, now, nm);
  const rows = await loadRows(ctx.org.id, id);
  const demo = rows === null || ctx.org.isDemo; // seeded history only without Postgres or on the demo org, never because a table is empty
  const { rip, head, row } = c;
  const author = head.src ? ((await roQuery(g, "MATCH (a:Artifact {id: $id}) RETURN a.author AS p", { id: head.src })) as { p: string | null }[])[0]?.p : null;
  const cids = [...new Set(rip.conflicts.flatMap((k) => k.contractIds))];
  const contracts = cids.length ? Contract.array().parse(await roQuery(g, load("reports-contracts").text, { ids: cids })) : [];
  const timeline = timelineFor(c, rows, now, demo);
  const sent = noticesSent(rows, id);
  const demoNotices = demo && sent === 0 && id === "d-1" ? DEMO_CUSTOMERS_NOTIFIED : 0;
  return {
    now, report: row,
    announcedBy: author ? { type: "person", id: author, name: nm.get(author) ?? author } : null,
    sourceRef: head.src && head.quote ? { artifactId: head.src, quote: head.quote } : null,
    counts: { teams: rip.counts.teamsAffected, customers: rip.counts.customers, tickets: rip.counts.tickets, deals: rip.counts.deals, contracts: rip.counts.contracts },
    teams: rip.teams.map((t) => ({
      teamId: t.teamId, name: nm.get(t.teamId) ?? t.teamId, expected: EXPECTED[t.teamId] ?? "Acknowledge the change",
      status: t.acked ? "acked" : t.involved ? "told" : "not_told", doneAt: c.toldAt.get(t.teamId) ?? null, why: t.why[0]?.reason ?? "is affected",
    })),
    timeline,
    conflicts: rip.conflicts.map((k) => ({
      id: k.id, severity: k.severity, status: k.status, detectedAt: Math.min(k.detectedAt, now), sources: k.sources,
      contracts: contracts.filter((x) => k.contractIds.includes(x.id)).map((x) => ({ id: x.id, name: x.name, guaranteedUntil: x.endsAt, arr: x.arr })),
    })),
    result: {
      arrAtRisk: rip.counts.arrAtRisk, teamsTold: row.coverage.told, teamsAcked: rip.teams.filter((t) => t.acked).length,
      openGaps: rip.counts.notTold, openConflicts: rip.counts.conflicts, noticesSent: sent || demoNotices, noticesSentDemo: demoNotices > 0,
    },
  };
}

export async function activity(ctx: Context, actor: Activity["actor"], limit: number): Promise<Activity> {
  const { graph: g, now } = ctx;
  const nm = await nameMap(g);
  const all = (await Promise.all((await openIds(g)).map(async (id) => {
    const c = await loadCase(g, id, now, nm);
    const rows = await loadRows(ctx.org.id, id);
    return timelineFor(c, rows, now, rows === null || ctx.org.isDemo).map((e) => ({ ...e, caseId: id, caseTitle: c.head.title }));
  }))).flat();
  const items = all.filter((e) => actor === "all" || e.actor.type === actor).sort((a, b) => b.at - a.at || a.id.localeCompare(b.id)).slice(0, limit);
  return { now, actor, items };
}
