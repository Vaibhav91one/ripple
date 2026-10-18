// The read-only audit log viewer behind /settings: filters parsed from the URL, one page of rows per request.
export const AUDIT_PAGE = 25;
export const ACTOR_TYPES = ["user", "apikey", "anon", "agent", "system"] as const;
export type AuditFilter = { actor?: string; action?: string; page: number };
export type AuditRow = { id: number; at: string; actorType: string; actorId: string | null; action: string; resource: string | null; outcome: "allow" | "deny" };

type Params = Record<string, string | string[] | undefined>;

/** Blank values are no filter; text is trimmed and capped; page is 1..1000. */
export function parseAuditFilter(sp: Params): AuditFilter {
  const one = (k: string) => {
    const v = sp[k];
    const s = (Array.isArray(v) ? v[0] : v)?.trim();
    return s ? s.slice(0, 120) : undefined;
  };
  const page = Math.min(1000, Math.max(1, Number.parseInt(one("page") ?? "", 10) || 1));
  return { actor: one("actor"), action: one("action"), page };
}

/** The /settings URL for a filter at a page (page 1 is left out). */
export function auditHref(f: AuditFilter, page = f.page): string {
  const q = new URLSearchParams();
  if (f.actor) q.set("actor", f.actor);
  if (f.action) q.set("action", f.action);
  if (page > 1) q.set("page", String(page));
  const s = q.toString();
  return `/settings${s ? `?${s}` : ""}#audit`;
}

/** `member.` matches every member.* action; LIKE wildcards in the input are literal. */
export const likePrefix = (s: string) => `${s.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

/** One page, newest first, for this org only. An actor filter is an actor type (user, agent...) or an exact actor id. */
export async function listAudit(orgId: string, f: AuditFilter): Promise<{ rows: AuditRow[]; more: boolean; actions: string[] }> {
  const [{ db }, { auditLog }, { and, desc, eq, like, sql }] = await Promise.all([import("./db"), import("./db/schema"), import("drizzle-orm")]);
  const d = db();
  const actor = f.actor && (ACTOR_TYPES.includes(f.actor as never) ? sql`${auditLog.actorType} = ${f.actor}` : eq(auditLog.actorId, f.actor));
  const where = and(eq(auditLog.orgId, orgId), actor || undefined, f.action ? like(auditLog.action, likePrefix(f.action)) : undefined);
  const [rows, actions] = await Promise.all([
    d.select().from(auditLog).where(where).orderBy(desc(auditLog.at), desc(auditLog.id)).limit(AUDIT_PAGE + 1).offset((f.page - 1) * AUDIT_PAGE),
    d.selectDistinct({ action: auditLog.action }).from(auditLog).where(eq(auditLog.orgId, orgId)).orderBy(auditLog.action).limit(100),
  ]);
  return {
    more: rows.length > AUDIT_PAGE,
    actions: actions.map((a) => a.action),
    rows: rows.slice(0, AUDIT_PAGE).map((r) => ({
      id: r.id, at: r.at.toISOString(), actorType: r.actorType, actorId: r.actorId, action: r.action,
      resource: r.resourceType ? `${r.resourceType}${r.resourceId ? ` ${r.resourceId}` : ""}` : null, outcome: r.outcome,
    })),
  };
}
