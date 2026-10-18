// Postgres side of the case file: the event log, audit log, pending actions, agent runs and deliveries for one change,
// mapped to timeline events. Everything here is optional: no DATABASE_URL, or any failure, yields no rows and the
// report falls back to the graph (plus labelled demo history). Pure mappers are exported for tests.
import { env } from "./env";
import type { TimelineEvent } from "./schemas/reports";

type Row = Record<string, unknown>;
const sec = (d: Date | string | null | undefined) => (d ? Math.floor(new Date(d).getTime() / 1000) : 0);
const obj = (v: unknown): Row => (v && typeof v === "object" ? (v as Row) : {});
/** Does a payload/subject/meta value belong to change `id`? Exact match on decisionId, changeId or subject.id; never a substring. */
export const touches = (id: string, ...vals: unknown[]) => vals.some((v) => v === id || obj(v).decisionId === id || obj(v).changeId === id || obj(obj(v).subject).id === id);

/** Which team owns the output of an action kind (mirrors lib/actions draftOwner). */
export const KIND_TEAM: Record<string, string> = {
  notice: "legal", amendment: "legal", email: "sales", talk_track: "sales", docs_change: "devrel", faq: "devrel", reply_macro: "support", audit_note: "security",
};
const proposer = { type: "agent", id: null, name: "Ripple agent" } as const;
const ripple = { type: "system", id: null, name: "Ripple" } as const;

export type PendingRow = { id: string; kind: string; status: string; payload: unknown; requestedAt: Date | string; approver: string | null; decidedAt: Date | string | null; result?: unknown };
/** Actions that put something on GitHub; they carry no decisionId, so they link to a change by naming its id in title or body. */
export const GITHUB_KINDS = ["create_issue", "pr_comment"];
export const isCase = (id: string, p: PendingRow) => touches(id, p.payload) || (GITHUB_KINDS.includes(p.kind) && [obj(p.payload).title, obj(p.payload).body].some((t) => typeof t === "string" && new RegExp(`(?<![\\w-])${id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\w-])`).test(t)));

export function pendingEvents(rows: PendingRow[], caseId: string, who: (id: string) => string): TimelineEvent[] {
  return rows.filter((r) => isCase(caseId, r)).flatMap((r): TimelineEvent[] => {
    const team = KIND_TEAM[r.kind] ?? null;
    if (GITHUB_KINDS.includes(r.kind)) {
      if (r.status !== "executed" || !r.decidedAt) return [];
      const url = typeof obj(r.result).url === "string" ? String(obj(r.result).url) : null;
      const by = !r.approver || r.approver === "policy" ? { type: "system" as const, id: null, name: "Policy" } : { type: "person" as const, id: r.approver, name: who(r.approver) };
      return [{ id: `pa-${r.id}`, at: sec(r.decidedAt), kind: "issue", actor: by, teamId: "eng", text: r.kind === "create_issue" ? `Opened GitHub issue: ${String(obj(r.payload).title ?? "")}` : "Commented on a GitHub pull request", url, source: "pending_actions", demo: false }];
    }
    const out: TimelineEvent[] = [{ id: `pa-${r.id}`, at: sec(r.requestedAt), kind: "proposed", actor: proposer, teamId: team, text: `Proposed a ${r.kind.replaceAll("_", " ")}`, url: null, source: "pending_actions", demo: false }];
    if (r.decidedAt && r.status !== "pending") {
      const ok = r.status !== "rejected" && r.status !== "expired";
      const by = !r.approver || r.approver === "policy" ? { type: "system" as const, id: null, name: "Policy" } : { type: "person" as const, id: r.approver, name: who(r.approver) };
      out.push({ id: `pa-${r.id}-d`, at: sec(r.decidedAt), kind: ok ? "approved" : "rejected", actor: by, teamId: team, text: `${ok ? "Approved" : "Rejected"} the ${r.kind.replaceAll("_", " ")}`, url: null, source: "pending_actions", demo: false });
    }
    return out;
  });
}

export type Rows = { events: Row[]; audit: Row[]; runs: Row[]; deliveries: Row[]; pending: PendingRow[] };

export function dbEvents(rows: Rows, caseId: string, who: (id: string) => string): TimelineEvent[] {
  const out: TimelineEvent[] = pendingEvents(rows.pending, caseId, who);
  for (const e of rows.events.filter((e) => touches(caseId, e.subjectId, e.payload))) {
    const type = String(e.type);
    out.push({ id: `ev-${e.id}`, at: sec(e.createdAt as Date), kind: type.includes("ack") ? "ack" : type.includes("conflict") ? "conflict" : type.includes("notif") || type.includes("chase") ? "notified" : "audit", actor: ripple, teamId: null, text: type.replaceAll(".", " "), url: null, source: "events", demo: false });
  }
  for (const a of rows.audit.filter((a) => touches(caseId, a.resourceId, a.meta))) {
    const t = String(a.actorType);
    out.push({ id: `au-${a.id}`, at: sec(a.at as Date), kind: "audit", actor: t === "user" && a.actorId ? { type: "person", id: String(a.actorId), name: who(String(a.actorId)) } : t === "agent" ? proposer : ripple, teamId: null, text: `${String(a.action).replaceAll(".", " ")}${a.outcome === "deny" ? " (denied)" : ""}`, url: null, source: "audit_log", demo: false });
  }
  for (const r of rows.runs.filter((r) => touches(caseId, r.input))) {
    out.push({ id: `run-${r.id}`, at: sec(r.startedAt as Date), kind: "run", actor: { type: "agent", id: String(r.agent), name: String(r.agent) }, teamId: null, text: `${String(r.agent)} run ${String(r.status)}`, url: null, source: "agent_runs", demo: false });
  }
  for (const d of rows.deliveries.filter((d) => touches(caseId, d.subject))) {
    out.push({ id: `dl-${d.id}`, at: sec((d.sentAt ?? d.queuedAt) as Date), kind: d.status === "acked" ? "ack" : "delivered", actor: ripple, teamId: null, text: `Sent by ${String(d.channel).replaceAll("_", " ")}: ${String(d.status)}`, url: null, source: "deliveries", demo: false });
  }
  return out;
}

export const EMPTY: Rows = { events: [], audit: [], runs: [], deliveries: [], pending: [] };
export type Group = { kind: string; status: string; n: number };

/**
 * The rows of one change, filtered in SQL (jsonb), newest 300 per table. null = no DATABASE_URL (callers may then show labelled
 * demo history). A database error is logged and answers the real empty state, never demo numbers.
 */
export async function loadRows(orgId: string, caseId: string): Promise<Rows | null> {
  if (!env().DATABASE_URL) return null;
  try {
    const [{ and, desc, eq, or, sql }, { db }, s] = await Promise.all([import("drizzle-orm"), import("./db"), import("./db/schema")]);
    const d = db();
    const [events, audit, runs, pending, dl] = await Promise.all([
      d.select().from(s.events).where(and(eq(s.events.orgId, orgId), or(eq(s.events.subjectId, caseId), sql`${s.events.payload}->>'decisionId' = ${caseId}`, sql`${s.events.payload}->>'changeId' = ${caseId}`))).orderBy(desc(s.events.createdAt)).limit(300),
      d.select().from(s.auditLog).where(and(eq(s.auditLog.orgId, orgId), or(eq(s.auditLog.resourceId, caseId), sql`${s.auditLog.meta}->>'decisionId' = ${caseId}`))).orderBy(desc(s.auditLog.at)).limit(300),
      d.select().from(s.agentRuns).where(and(eq(s.agentRuns.orgId, orgId), sql`${s.agentRuns.input}->>'decisionId' = ${caseId}`)).orderBy(desc(s.agentRuns.startedAt)).limit(300),
      d.select().from(s.pendingActions).where(and(eq(s.pendingActions.orgId, orgId), or(
        sql`${s.pendingActions.payload}->>'decisionId' = ${caseId}`,
        and(sql`${s.pendingActions.kind} in ('create_issue','pr_comment')`, sql`(${s.pendingActions.payload}->>'title' like ${`%${caseId}%`} or ${s.pendingActions.payload}->>'body' like ${`%${caseId}%`})`),
      ))).orderBy(desc(s.pendingActions.requestedAt)).limit(300),
      d.select({ id: s.deliveries.id, channel: s.deliveries.channel, status: s.deliveries.status, queuedAt: s.deliveries.queuedAt, sentAt: s.deliveries.sentAt, subject: s.notifications.body })
        .from(s.deliveries).innerJoin(s.notifications, eq(s.deliveries.notificationId, s.notifications.id))
        .where(and(eq(s.notifications.orgId, orgId), sql`${s.notifications.body}->'subject'->>'id' = ${caseId}`)).orderBy(desc(s.deliveries.queuedAt)).limit(300),
    ]);
    return { events, audit, runs, deliveries: dl, pending } as unknown as Rows;
  } catch (e) {
    console.error("reports: postgres query failed, showing the real empty state:", e instanceof Error ? e.message : e);
    return EMPTY;
  }
}

/** Org-wide approval counts by kind and status, plus the median hours from request to decision (SQL, not capped). null = no database. */
export async function loadAgentGroups(orgId: string): Promise<{ groups: Group[]; medianHours: number | null } | null> {
  if (!env().DATABASE_URL) return null;
  try {
    const [{ eq, sql }, { db }, { pendingActions: p }] = await Promise.all([import("drizzle-orm"), import("./db"), import("./db/schema")]);
    const d = db();
    const groups = await d.select({ kind: p.kind, status: p.status, n: sql<number>`count(*)::int` }).from(p).where(eq(p.orgId, orgId)).groupBy(p.kind, p.status);
    const [m] = await d.select({ h: sql<number | null>`percentile_cont(0.5) within group (order by extract(epoch from (${p.decidedAt} - ${p.requestedAt})) / 3600)` }).from(p).where(sql`${p.orgId} = ${orgId} and ${p.decidedAt} is not null and ${p.status} <> 'pending'`);
    return { groups, medianHours: m?.h == null ? null : Number(m.h) };
  } catch (e) {
    console.error("reports: agent stats query failed:", e instanceof Error ? e.message : e);
    return { groups: [], medianHours: null };
  }
}
