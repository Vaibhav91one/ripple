import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "../../db";
import { connectorAccounts } from "../../db/schema";

export type SlackAccountRef = { id: string; orgId: string };
export type SaveInstall = { orgId: string; teamId: string; tokenEnc: string; scopes: string[] };

/** The org(s) that installed the app in this Slack workspace. */
export const accountsForTeam = (teamId: string): Promise<SlackAccountRef[]> =>
  db().select({ id: connectorAccounts.id, orgId: connectorAccounts.orgId }).from(connectorAccounts)
    .where(and(eq(connectorAccounts.kind, "slack"), eq(connectorAccounts.externalId, teamId), eq(connectorAccounts.status, "active")));

/** Insert, or refresh the token and scopes on a reinstall. */
export async function saveInstall(i: SaveInstall): Promise<void> {
  await db().insert(connectorAccounts).values({ orgId: i.orgId, kind: "slack", externalId: i.teamId, tokenEnc: i.tokenEnc, scopes: i.scopes })
    .onConflictDoUpdate({
      target: [connectorAccounts.orgId, connectorAccounts.kind, connectorAccounts.externalId],
      set: { tokenEnc: i.tokenEnc, scopes: i.scopes, status: "active" },
    });
}
