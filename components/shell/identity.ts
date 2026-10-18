import { authEnabled } from "@/lib/auth";

export type ShellUser = { name: string; role: string; org: string; initials: string };

/** Who the sidebar user card shows, read from the environment (no request data, so the shell stays static).
 *  Signed-in Clerk users get the Clerk controls next to it (AuthArea); this is the fallback identity. */
export function shellUser(src: Record<string, string | undefined> = process.env): ShellUser {
  if (!authEnabled(src) && src.RIPPLE_MODE === "local") return { name: "Local workspace", role: "Admin", org: "local", initials: "LW" };
  if (authEnabled(src)) return { name: "Your workspace", role: "Member", org: "Ripple", initials: "RW" };
  return { name: "Demo visitor", role: "Viewer", org: "Ledgerly", initials: "DV" };
}
