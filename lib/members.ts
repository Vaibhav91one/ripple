// Org members as Ripple sees them: one memberships row per (user, team), plus the org-wide '*' row the Clerk webhook writes.
// Role and person link live on every row of a user; the team list is the non-'*' rows.
import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "./db";
import { memberships } from "./db/schema";
import { ALL_TEAMS } from "./clerk-sync";

export type Role = "member" | "lead" | "admin" | "change_owner";
const RANK: Role[] = ["member", "lead", "change_owner", "admin"];
export type Member = { userId: string; role: Role; teamIds: string[]; personId: string | null };

type Row = typeof memberships.$inferSelect;
function fold(rows: Row[]): Member[] {
  const by = new Map<string, Member>();
  for (const r of rows) {
    const m = by.get(r.userId) ?? { userId: r.userId, role: "member" as Role, teamIds: [], personId: null };
    if (r.teamId !== ALL_TEAMS) m.teamIds.push(r.teamId);
    if (RANK.indexOf(r.role) > RANK.indexOf(m.role)) m.role = r.role;
    m.personId ??= r.personId;
    by.set(r.userId, m);
  }
  return [...by.values()].sort((a, b) => a.userId.localeCompare(b.userId));
}

export async function listMembers(orgId: string, d = db()): Promise<Member[]> {
  return fold(await d.select().from(memberships).where(eq(memberships.orgId, orgId)));
}

export async function getMember(orgId: string, userId: string, d = db()): Promise<Member | null> {
  return fold(await d.select().from(memberships).where(and(eq(memberships.orgId, orgId), eq(memberships.userId, userId))))[0] ?? null;
}

export type MemberPatch = { userId: string; role?: Role; teamIds?: string[]; personId?: string | null };

/** Apply a patch to an existing member; false when the user has no rows in the org. */
export async function updateMember(orgId: string, { userId, role, teamIds, personId }: MemberPatch, d = db()): Promise<boolean> {
  const cur = await getMember(orgId, userId, d);
  if (!cur) return false;
  let added: string[] = [];
  const mine = and(eq(memberships.orgId, orgId), eq(memberships.userId, userId));
  await d.transaction(async (tx) => {
    const set = { ...(role && { role }), ...(personId !== undefined && { personId }) };
    if (Object.keys(set).length) await tx.update(memberships).set(set).where(mine);
    if (teamIds) {
      const want = [...new Set(teamIds.filter((t) => t !== ALL_TEAMS))];
      const drop = cur.teamIds.filter((t) => !want.includes(t));
      if (drop.length) await tx.delete(memberships).where(and(mine, inArray(memberships.teamId, drop)));
      const add = want.filter((t) => !cur.teamIds.includes(t));
      added = add;
      if (add.length) {
        const role2 = role ?? cur.role, person = personId === undefined ? cur.personId : personId;
        await tx.insert(memberships).values(add.map((teamId) => ({ orgId, userId, teamId, role: role2, personId: person })));
      }
    }
  });
  const who = personId === undefined ? cur.personId : personId; // after commit, so the worker finds the rows
  if (added.length && who) await (await import("./events/emit")).emitMemberAdded(d, orgId, who, added, userId);
  return true;
}
