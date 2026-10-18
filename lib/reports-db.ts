// Postgres side of the case file: the event log, audit log, pending actions, agent runs and deliveries for one change,
// mapped to timeline events. Everything here is optional: no DATABASE_URL, or any failure, yields no rows and the
// report falls back to the graph (plus labelled demo history). Pure mappers are exported for tests.
import { env } from "./env";
import type { TimelineEvent } from "./schemas/reports";

type Row = Record<string, unknown>;
const sec = (d: Date | string | null | undefined) => (d ? Math.floor(new Date(d).getTime() / 1000) : 0);
const obj = (v: unknown): Row => (v && typeof v === "object" ? (v as Row) : {});
const touches = (id: string, ...vals: unknown[]) => vals.some((v) => v === id || obj(v).decisionId === id || obj(obj(v).subject).id === id);

/** Which team owns the output of an action kind (mirrors lib/actions draftOwner). */
export const KIND_TEAM: Record<string, string> = {
  notice: "legal", amendment: "legal", email: "sales", talk_track: "sales", docs_change: "devrel", faq: "devrel", reply_macro: "support", audit_note: "security",
};
const proposer = { type: "agent", id: null, name: "Ripple agent" } as const;
const ripple = { type: "system", id: null, name: "Ripple" } as const;

export type PendingRow = { id: string; kind: string; status: string; payload: unknown; requestedAt: Date | string; approver: string | null; decidedAt: Date | string | null };

export function pendingEvents(rows: PendingRow[], caseId: string, who: (id: string) => string): TimelineEvent[] {
  return rows.filter((r) => touches(caseId, r.payload)).flatMap((r): TimelineEvent[] => {
    const team = KIND_TEAM[r.kind] ?? null;
    const out: TimelineEvent[] = [{ id: `pa-${r.id}`, at: sec(r.requestedAt), kind: "proposed", actor: proposer, teamId: team, text: `Proposed a ${r.kind.replaceAll("_", " ")}`, source: "pending_actions", demo: false }];
    if (r.decidedAt && r.status !== "pending") {
      const ok = r.status !== "rejected" && r.status !== "expired";
      const by = !r.approver || r.approver === "policy" ? { type: "system" as const, id: null, name: "Policy" } : { type: "person" as const, id: r.approver, name: who(r.approver) };
      out.push({ id: `pa-${r.id}-d`, at: sec(r.decidedAt), kind: ok ? "approved" : "rejected", actor: by, teamId: team, text: `${ok ? "Approved" : "Rejected"} the ${r.kind.replaceAll("_", " ")}`, source: "pending_actions", demo: false });
    }
    return out;
  });
}

export type Rows = { events: Row[]; audit: Row[]; runs: Row[]; deliveries: Row[]; pending: PendingRow[] };

export function dbEvents(rows: Rows, caseId: string, who: (id: string) => string): TimelineEvent[] {
  const out: TimelineEvent[] = pendingEvents(rows.pending, caseId, who);
  for (const e of rows.events.filter((e) => touches(caseId, e.subjectId, e.payload))) {
    const type = String(e.type);
    out.push({ id: `ev-${e.id}`, at: sec(e.createdAt as Date), kind: type.includes("ack") ? "ack" : type.includes("conflict") ? "conflict" : type.includes("notif") || type.includes("chase") ? "notified" : "audit", actor: ripple, teamId: null, text: type.replaceAll(".", " "), source: "events", demo: false });
  }
  for (const a of rows.audit.filter((a) => touches(caseId, a.resourceId, a.meta))) {
    const t = String(a.actorType);
    out.push({ id: `au-${a.id}`, at: sec(a.at as Date), kind: "audit", actor: t === "user" && a.actorId ? { type: "person", id: String(a.actorId), name: who(String(a.actorId)) } : t === "agent" ? proposer : ripple, teamId: null, text: `${String(a.action).replaceAll(".", " ")}${a.outcome === "deny" ? " (denied)" : ""}`, source: "audit_log", demo: false });
  }
  for (const r of rows.runs.filter((r) => touches(caseId, r.input))) {
    out.push({ id: `run-${r.id}`, at: sec(r.startedAt as Date), kind: "run", actor: { type: "agent", id: String(r.agent), name: String(r.agent) }, teamId: null, text: `${String(r.agent)} run ${String(r.status)}`, source: "agent_runs", demo: false });
  }
  for (const d of rows.deliveries.filter((d) => touches(caseId, d.subject))) {
    out.push({ id: `dl-${d.id}`, at: sec((d.sentAt ?? d.queuedAt) as Date), kind: d.status === "acked" ? "ack" : "delivered", actor: ripple, teamId: null, text: `Sent by ${String(d.channel).replaceAll("_", " ")}: ${String(d.status)}`, source: "deliveries", demo: false });
  }
  return out;
}

/** The rows, newest 300 per table for this org. null = no database. ponytail: filtered in JS; add a jsonb index if an org outgrows 300 recent rows. */
export async function loadRows(orgId: string): Promise<Rows | null> {
  if (!env().DATABASE_URL) return null;
  try {
    const [{ desc, eq }, { db }, s] = await Promise.all([import("drizzle-orm"), import("./db"), import("./db/schema")]);
    const d = db();
    const [events, audit, runs, pending, dl] = await Promise.all([
      d.select().from(s.events).where(eq(s.events.orgId, orgId)).orderBy(desc(s.events.createdAt)).limit(300),
      d.select().from(s.auditLog).where(eq(s.auditLog.orgId, orgId)).orderBy(desc(s.auditLog.at)).limit(300),
      d.select().from(s.agentRuns).where(eq(s.agentRuns.orgId, orgId)).orderBy(desc(s.agentRuns.startedAt)).limit(300),
      d.select().from(s.pendingActions).where(eq(s.pendingActions.orgId, orgId)).orderBy(desc(s.pendingActions.requestedAt)).limit(300),
      d.select({ id: s.deliveries.id, channel: s.deliveries.channel, status: s.deliveries.status, queuedAt: s.deliveries.queuedAt, sentAt: s.deliveries.sentAt, subject: s.notifications.body })
        .from(s.deliveries).innerJoin(s.notifications, eq(s.deliveries.notificationId, s.notifications.id)).where(eq(s.notifications.orgId, orgId)).orderBy(desc(s.deliveries.queuedAt)).limit(300),
    ]);
    return { events, audit, runs, deliveries: dl, pending } as unknown as Rows;
  } catch (e) {
    console.error("reports: postgres unavailable, using the graph only:", e instanceof Error ? e.message : e);
    return null;
  }
}
