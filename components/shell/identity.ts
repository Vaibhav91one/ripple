import { authEnabled } from "@/lib/auth";

export type ShellUser = { name: string; role: string; org: string; initials: string };

export const DEMO_USER: ShellUser = { name: "Demo visitor", role: "Viewer", org: "Ledgerly", initials: "DV" };

/** RIPPLE_MODE=local without Clerk: the same rule getContext uses for the writable `local` org. */
export const isLocalMode = (src: Record<string, string | undefined> = process.env) => !authEnabled(src) && src.RIPPLE_MODE === "local";

/** Who the sidebar user card shows, read from the environment (no request data, so the shell stays static).
 *  It is the first paint only: AppShell swaps in /api/me (lib/me.ts), the same identity /profile shows. */
export function shellUser(src: Record<string, string | undefined> = process.env): ShellUser {
  if (isLocalMode(src)) return { name: "Local workspace", role: "Admin", org: "local", initials: "LW" };
  if (authEnabled(src)) return { name: "Your workspace", role: "Member", org: "Ripple", initials: "RW" };
  return DEMO_USER;
}
