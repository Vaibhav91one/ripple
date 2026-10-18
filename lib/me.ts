// Who is asking, in plain words: the identity /api/me, /profile and /settings show. No secrets, no tokens.
import { shellUser } from "@/components/shell/identity";
import { LENSES, LENS_TEAM, type Lens } from "./lens";
import { LOCAL_ORG, type Context } from "./server/context";

export type Mode = "demo" | "local" | "clerk";
export type Me = { mode: Mode; name: string; role: string; org: string; teamIds: string[]; lens: Lens | null };

export const modeOf = (ctx: Pick<Context, "viewer" | "org">): Mode =>
  ctx.viewer.kind === "anon" ? "demo" : ctx.viewer.userId === "local" && ctx.org.id === LOCAL_ORG ? "local" : "clerk";

/** Demo and local read the same identity as the sidebar card (shellUser); a Clerk session adds the real name, role and org. */
export async function me(ctx: Pick<Context, "viewer" | "org">): Promise<Me> {
  const mode = modeOf(ctx);
  const u = shellUser();
  const teamIds = ctx.viewer.teamIds;
  if (mode !== "clerk") return { mode, name: u.name, role: u.role, org: u.org, teamIds, lens: LENSES.find((l) => LENS_TEAM[l] === teamIds[0]) ?? null };
  let name = u.name;
  try {
    const { currentUser } = await import("@clerk/nextjs/server");
    const c = await currentUser();
    name = c?.fullName || c?.username || name;
  } catch { /* no Clerk lookup: keep the fallback name */ }
  return { mode, name, role: ctx.viewer.role, org: ctx.org.id, teamIds, lens: null };
}

export const initials = (name: string) => name.split(/\s+/).filter(Boolean).map((w) => w[0]).join("").slice(0, 2).toUpperCase() || "?";
