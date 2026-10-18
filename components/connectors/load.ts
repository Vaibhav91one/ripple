// Server-side: the viewer's org connections plus the one note a page shows above them. Per request, never cached.
import "server-only";
import { signedInWithoutOrg } from "@/lib/auth";
import { NONE, type Connections } from "@/lib/connectors/state";
import { env } from "@/lib/env";
import { safeMessage } from "@/lib/log";
import type { Context } from "@/lib/server/context";

export type ConnectionsView = { conns: Connections; note?: string; canManage: boolean; demo: boolean };

export const SELECT_ORG = "Select an organization (top of the sidebar) to see and manage its connections.";
export const DEMO_NOTE = "This is the shared demo. Its graph is seeded, so nothing is connected here; self-host Ripple or sign in to connect your own sources.";

export async function loadConnections(ctx: Pick<Context, "org" | "viewer" | "readonly">): Promise<ConnectionsView> {
  const canManage = !ctx.readonly && ctx.viewer.kind === "user" && ctx.viewer.role === "admin";
  if (ctx.readonly) return { conns: NONE, canManage, demo: true, note: (await signedInWithoutOrg()) ? SELECT_ORG : DEMO_NOTE };
  if (!env().DATABASE_URL) return { conns: NONE, canManage, demo: false, note: "Postgres isn't configured, so no accounts can be connected." };
  try {
    return { conns: await (await import("@/lib/connectors/state")).connectionState(ctx.org.id), canManage, demo: false };
  } catch (e) {
    console.error("connection state failed:", safeMessage(e));
    return { conns: NONE, canManage, demo: false, note: "Connected accounts could not be loaded." };
  }
}
