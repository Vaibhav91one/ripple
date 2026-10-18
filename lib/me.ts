// Who is asking, in plain words: the identity /api/me, /profile and /settings show. No secrets, no tokens.
import { DEMO_USER, shellUser } from "@/components/shell/identity";
import { LENSES, LENS_TEAM, type Lens } from "./lens";
import { LOCAL_ORG, type Context } from "./server/context";

export type Mode = "demo" | "local" | "clerk";
export type Me = { mode: Mode; name: string; role: string; org: string; initials: string; teamIds: string[]; lens: Lens | null };

const ROLE_WORD = { admin: "Admin", lead: "Lead", change_owner: "Change owner", member: "Member" } as const;

export const modeOf = (ctx: Pick<Context, "viewer" | "org">): Mode =>
  ctx.viewer.kind === "anon" ? "demo" : ctx.viewer.userId === "local" && ctx.org.id === LOCAL_ORG ? "local" : "clerk";

/** The one identity /api/me, /profile and the sidebar card show. Demo and local use shellUser; a Clerk session adds the real name, role and org name. */
export async function me(ctx: Pick<Context, "viewer" | "org">): Promise<Me> {
  const mode = modeOf(ctx);
  const u = mode === "demo" ? DEMO_USER : shellUser();
  const teamIds = ctx.viewer.teamIds;
  if (mode !== "clerk") return { mode, name: u.name, role: u.role, org: u.org, initials: initials(u.name), teamIds, lens: LENSES.find((l) => LENS_TEAM[l] === teamIds[0]) ?? null };
  const v = ctx.viewer;
  let name = "Signed-in user";
  let org = "Your organization"; // never the raw org id
  try {
    const { currentUser, clerkClient } = await import("@clerk/nextjs/server");
    const c = await currentUser();
    name = c?.fullName || c?.username || c?.primaryEmailAddress?.emailAddress || name;
    org = (await (await clerkClient()).organizations.getOrganization({ organizationId: ctx.org.id })).name || org;
  } catch { /* no Clerk lookup: keep the fallbacks */ }
  const role = v.kind === "user" ? ROLE_WORD[v.role] : "Member";
  return { mode, name, role, org, initials: initials(name), teamIds, lens: null };
}

export const initials = (name: string) => name.split(/\s+/).filter(Boolean).map((w) => w[0]).join("").slice(0, 2).toUpperCase() || "?";
