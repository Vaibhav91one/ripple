import { getContext } from "../server/context";

/** Who owns persisted threads: a non-demo viewer (Clerk org or local mode) with Postgres. Null = public demo / no DB (the client keeps threads in localStorage). */
export async function owner(req?: Request) {
  if (!process.env.DATABASE_URL) return null;
  try {
    const ctx = await getContext(req);
    return !ctx.org.isDemo && ctx.viewer.kind === "user" ? { orgId: ctx.org.id, userId: ctx.viewer.userId, graphName: ctx.org.graphName } : null;
  } catch {
    return null;
  }
}
export const noPersist = () => Response.json({ persist: false, conversations: [] });
