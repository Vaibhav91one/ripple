import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "../../db";
import { changeChannels, connectorAccounts, teamChannels as teamChannelTable } from "../../db/schema";

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

/** The change's Slack channel id, from change_channel. */
export async function channelForChange(orgId: string, changeId: string): Promise<string | null> {
  const [r] = await db().select({ c: changeChannels.channelId }).from(changeChannels)
    .where(and(eq(changeChannels.orgId, orgId), eq(changeChannels.changeId, changeId))).limit(1);
  return r?.c ?? null;
}

/** The change a Slack channel belongs to (keyed by channel id, so it survives a rename). */
export async function changeForChannel(orgId: string, channelId: string): Promise<string | null> {
  const [r] = await db().select({ c: changeChannels.changeId }).from(changeChannels)
    .where(and(eq(changeChannels.orgId, orgId), eq(changeChannels.channelId, channelId))).limit(1);
  return r?.c ?? null;
}

/** Courier (#188) calls this when it creates a change's channel. */
export async function setChangeChannel(i: { orgId: string; changeId: string; slackTeamId: string; channelId: string; name: string }): Promise<void> {
  await db().insert(changeChannels).values(i)
    .onConflictDoUpdate({ target: [changeChannels.orgId, changeChannels.changeId], set: { channelId: i.channelId, name: i.name, slackTeamId: i.slackTeamId } });
}
