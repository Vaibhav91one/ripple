// Clerk is optional: without both keys, or with RIPPLE_AUTH=off, nothing here touches Clerk and every viewer is the demo.
import { env } from "./env";

export function authEnabled(src: Record<string, string | undefined> = process.env): boolean {
  const e = env(src);
  return e.RIPPLE_AUTH !== "off" && !!e.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && !!e.CLERK_SECRET_KEY;
}

/** The signed-in user in their active org, or null (signed out, no active org, auth off, or called outside a request). */
export async function sessionViewer() {
  if (!authEnabled()) return null;
  try {
    const { auth } = await import("@clerk/nextjs/server");
    const { userId, orgId, orgRole, orgSlug } = await auth();
    if (!userId || !orgId) return null;
    return { kind: "user" as const, userId, orgId, orgSlug: orgSlug ?? undefined, teamIds: [], role: orgRole === "org:admin" ? ("admin" as const) : ("member" as const) };
  } catch {
    return null; // no request scope (scripts, tests) or no clerkMiddleware on this path: stay public
  }
}
