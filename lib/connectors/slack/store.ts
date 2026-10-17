import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "../../db";
import { connectorAccounts, teamChannels as teamChannelTable } from "../../db/schema";

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

/** The encrypted bot token of the org's active Slack install; null = Slack isn't connected. */
export async function slackToken(orgId: string): Promise<string | null> {
  const [r] = await db().select({ t: connectorAccounts.tokenEnc }).from(connectorAccounts)
    .where(and(eq(connectorAccounts.orgId, orgId), eq(connectorAccounts.kind, "slack"), eq(connectorAccounts.status, "active"))).limit(1);
  return r?.t ?? null;
}

/** team id -> Slack channel id. */
export async function teamChannels(orgId: string): Promise<Map<string, string>> {
  const rows = await db().select().from(teamChannelTable).where(eq(teamChannelTable.orgId, orgId));
  return new Map(rows.map((r) => [r.teamId, r.slackChannelId]));
}

/** Set a team's channel; an empty id clears it. */
export async function setTeamChannel(orgId: string, teamId: string, channelId: string): Promise<void> {
  if (!channelId) { await db().delete(teamChannelTable).where(and(eq(teamChannelTable.orgId, orgId), eq(teamChannelTable.teamId, teamId))); return; }
  await db().insert(teamChannelTable).values({ orgId, teamId, slackChannelId: channelId })
    .onConflictDoUpdate({ target: [teamChannelTable.orgId, teamChannelTable.teamId], set: { slackChannelId: channelId } });
}
