import { sessionViewer } from "../auth";
import { env } from "../env";

/** Who owns persisted threads: a signed-in user with Postgres. Null = demo / no accounts (the client keeps threads in localStorage). */
export async function owner() {
  const s = await sessionViewer();
  return s && env().DATABASE_URL ? { orgId: s.orgId, userId: s.userId } : null;
}
export const noPersist = () => Response.json({ persist: false, conversations: [] });
