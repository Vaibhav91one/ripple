import "server-only";
import { and, eq } from "drizzle-orm";
import { graphNameFor } from "./server/context";
import { db } from "./db";
import { memberships, orgs } from "./db/schema";

// Minimal view of the Clerk webhook payloads we use (organization.* and organizationMembership.*).
export type ClerkEvent = { type: string; data: { id?: string; slug?: string; role?: string; organization?: { id: string; slug?: string }; public_user_data?: { user_id: string } } };

/** Org-wide membership row; per-team roles are assigned later in Ripple, not in Clerk. */
export const ALL_TEAMS = "*";

/** Mirror Clerk orgs and memberships into Postgres. The org's graph is named after its Clerk id. Idempotent. */
export async function applyClerkEvent({ type, data }: ClerkEvent, d = db()): Promise<boolean> {
  if (type === "organization.created" || type === "organization.updated") {
    const id = data.id!, slug = data.slug ?? id;
    await d.insert(orgs).values({ id, slug, graphName: graphNameFor(id) }).onConflictDoUpdate({ target: orgs.id, set: { slug } });
  } else if (type === "organization.deleted") {
    await d.delete(orgs).where(eq(orgs.id, data.id!)); // cascades memberships and API keys
  } else if (type.startsWith("organizationMembership.")) {
    const orgId = data.organization?.id, userId = data.public_user_data?.user_id;
    if (!orgId || !userId) return false;
    if (type.endsWith(".deleted")) await d.delete(memberships).where(and(eq(memberships.orgId, orgId), eq(memberships.userId, userId)));
    else {
      const slug = data.organization?.slug ?? orgId;
      await d.insert(orgs).values({ id: orgId, slug, graphName: graphNameFor(orgId) }).onConflictDoNothing(); // membership can arrive before organization.created
      const role = data.role === "org:admin" ? "admin" : "member";
      await d.insert(memberships).values({ orgId, userId, teamId: ALL_TEAMS, role }).onConflictDoUpdate({ target: [memberships.orgId, memberships.userId, memberships.teamId], set: { role } });
    }
  } else return false;
  return true;
}
