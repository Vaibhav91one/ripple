// Slack `message` events -> evidence (#177). Resolves the org's changes, channels and people, then calls recordEvidenceFromMessage.
import "server-only";
import { eq } from "drizzle-orm";
import { db } from "../../db";
import { changeChannels, teamChannels } from "../../db/schema";
import { type Graph, roQuery } from "../../graph/client";
import { recordEvidenceFromMessage, type KnownChange } from "./evidence";
import type { Deps } from "./interactive";

type Who = { personId: string; teamId: string | null } | null;
const TTL = 10 * 60_000;
// ponytail: per-process cache keyed by org+slack user; swap for a shared cache if workers multiply.
const people = new Map<string, { at: number; who: Who }>();

export function messageHook(o: { graph: () => Promise<Graph>; slack: Deps["slack"] }): Deps["onMessageEvent"] {
  return async ({ orgId, teamId, event }) => {
    if (event.type !== "message" || !event.channel) return;
    const g = await o.graph();
    const [rows, chans, teams] = await Promise.all([
      roQuery<{ id: string; title: string }>(g, "MATCH (c:Change) RETURN c.id AS id, coalesce(c.title, c.name, '') AS title"),
      db().select().from(changeChannels).where(eq(changeChannels.orgId, orgId)),
      db().select().from(teamChannels).where(eq(teamChannels.orgId, orgId)),
    ]);
    const byChange = new Map(chans.map((r) => [r.changeId, r.channelId]));
    const changes: KnownChange[] = rows.map((r) => ({ id: r.id, title: r.title, channelId: byChange.get(r.id) }));
    if (!chans.some((r) => r.channelId === event.channel)) {
      // Legacy fallback, only when the channel has no change_channel row: a channel named chg-<id>.
      const name = (await o.slack.call<{ channel: { name: string } }>("conversations.info", { channel: event.channel }).catch(() => null))?.channel.name;
      const c = changes.find((x) => !x.channelId && name === `chg-${x.id}`);
      if (c) c.channelId = event.channel;
    }
    const teamByChannel = new Map(teams.map((t) => [t.slackChannelId, t.teamId]));
    await recordEvidenceFromMessage({
      db: db(), orgId, changes, teamOfChannel: (c) => teamByChannel.get(c) ?? null,
      permalink: async (channel, ts) => (await o.slack.call<{ permalink: string }>("chat.getPermalink", { channel, message_ts: ts })).permalink,
      async person(slackUser) {
        const key = `${orgId}:${teamId}:${slackUser}`;
        const hit = people.get(key);
        if (hit && Date.now() - hit.at < TTL) return hit.who;
        let who: Who = null;
        try {
          const email = (await o.slack.call<{ user: { profile?: { email?: string } } }>("users.info", { user: slackUser })).user.profile?.email?.toLowerCase();
          if (email) {
            const r = (await roQuery<{ id: string; team: string | null }>(g,
              "MATCH (p:Person) WHERE toLower(p.email) = $email OPTIONAL MATCH (p)-[:MEMBER_OF]->(t:Team) RETURN p.id AS id, t.id AS team LIMIT 1", { email }))[0];
            if (r) who = { personId: r.id, teamId: r.team };
          }
        } catch { return null; } // lookup failed: store the evidence unmapped, don't cache the miss
        people.set(key, { at: Date.now(), who });
        return who;
      },
    }, event);
  };
}
