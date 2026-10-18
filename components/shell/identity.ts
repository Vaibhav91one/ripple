import { authEnabled } from "@/lib/auth";

export type ShellUser = { name: string; role: string; org: string; initials: string };

/** RIPPLE_MODE=local without Clerk: the same rule getContext uses for the writable `local` org. */
export const isLocalMode = (src: Record<string, string | undefined> = process.env) => !authEnabled(src) && src.RIPPLE_MODE === "local";

/** Who the sidebar user card shows, read from the environment (no request data, so the shell stays static).
 *  Signed-in Clerk users get the Clerk controls next to it (AuthArea); this is the fallback identity. */
export function shellUser(src: Record<string, string | undefined> = process.env): ShellUser {
  if (isLocalMode(src)) return { name: "Local workspace", role: "Admin", org: "local", initials: "LW" };
  if (authEnabled(src)) return { name: "Your workspace", role: "Member", org: "Ripple", initials: "RW" };
  return { name: "Demo visitor", role: "Viewer", org: "Ledgerly", initials: "DV" };
}
