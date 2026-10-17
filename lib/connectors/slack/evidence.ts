// "Discussed" evidence from Slack message events. Never polls conversations.history (Tier 1, 1 req/min for non-Marketplace apps).
// Integration point (#176, slack-inbound handler): on a `message` event call
//   recordEvidenceFromMessage(ctx, job.data)   // job.data = the Slack `event` object, as ingest() enqueues it
// Evidence is stored separately from deliveries: it can never flip an ack.
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { emit } from "../../events/emit";
import type * as schema from "../../db/schema";
import { evidence } from "../../db/schema";

/** The part of a Slack `message` event we read. */
export type SlackMessageEvent = {
  type?: string; subtype?: string; bot_id?: string; channel?: string; user?: string; text?: string; ts?: string; thread_ts?: string;
};
export type KnownChange = { id: string; title: string; /** its #chg- Slack channel, when one exists */ channelId?: string };

export type EvidenceCtx = {
  db: PostgresJsDatabase<typeof schema>;
  orgId: string;
  changes: KnownChange[];
  /** Slack user id -> graph person (null = not mapped; tracked via users.lookupByEmail ↔ Person email). */
  person: (slackUserId: string) => Promise<{ personId: string; teamId: string | null } | null> | { personId: string; teamId: string | null } | null;
  /** Slack channel id -> the team whose channel it is (team_channel), when known. */
  teamOfChannel?: (channelId: string) => string | null;
  /** chat.getPermalink (Tier 3); null on failure, the evidence is stored without a link. */
  permalink: (channel: string, ts: string) => Promise<string | null>;
};

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Changes a message is about: its #chg- channel, a /changes/<id> or /items/<id> link, the change id as a word, or its title. */
export function matchChanges(m: Pick<SlackMessageEvent, "channel" | "text">, changes: KnownChange[]): KnownChange[] {
  const text = (m.text ?? "").toLowerCase();
  return changes.filter((c) => {
    const id = esc(c.id.toLowerCase());
    return (
      (!!c.channelId && c.channelId === m.channel) ||
      new RegExp(`/(?:changes|items)/${id}(?![\\w-])`).test(text) ||
      new RegExp(`(?<![\\w-])${id}(?![\\w-])`).test(text) ||
      (c.title.trim().length >= 4 && text.includes(c.title.trim().toLowerCase()))
    );
  });
}

/** Returns how many new evidence rows were stored (0 for bots, edits, unrelated text or a replayed event). */
export async function recordEvidenceFromMessage(ctx: EvidenceCtx, m: SlackMessageEvent): Promise<number> {
  if (m.type !== "message" || m.bot_id || (m.subtype && m.subtype !== "thread_broadcast")) return 0; // our own and other bots' posts are not "told"
  if (!m.channel || !m.ts) return 0;
  const hits = matchChanges(m, ctx.changes);
  if (!hits.length) return 0;

  const who = m.user ? await ctx.person(m.user) : null;
  const teamId = who?.teamId ?? ctx.teamOfChannel?.(m.channel) ?? null;
  const permalink = await ctx.permalink(m.channel, m.ts).catch(() => null);
  let stored = 0;
  for (const c of hits) {
    const [row] = await ctx.db.insert(evidence).values({
      orgId: ctx.orgId, changeId: c.id, teamId, channelId: m.channel, messageTs: m.ts, permalink,
      authorSlackId: m.user ?? null, personId: who?.personId ?? null,
    }).onConflictDoNothing().returning({ id: evidence.id });
    if (!row) continue; // Slack retried or the message was edited into the same match
    stored++;
    await emit(ctx.db, {
      type: "evidence.recorded", orgId: ctx.orgId, subject: { kind: "change", id: c.id },
      payload: { changeId: c.id, channelId: m.channel, ...(teamId && { teamId }), ...(who && { personId: who.personId }) },
      dedupeKey: `evidence.recorded:${c.id}:${m.channel}:${m.ts}`,
    });
  }
  return stored;
}
