// Campaign side effects. Called only by the campaign_plan / slack_channel_create / slack_post executors, i.e. after a person (or the org policy) approved.
import { createHash } from "node:crypto";
import { z } from "zod";
import { query, roQuery, type Graph } from "../graph/client";
import { load } from "../graph/queries";
import { archive, createChannel, invite, pin, updateMessage } from "../connectors/slack/channel";
import type { slackClient } from "../connectors/slack/client";
import { campaignStatus, renderTracker } from "./status";
import { CampaignPlan } from "./plan";

export const SlackChannelCreate = z.object({ decisionId: z.string().min(1), campaignId: z.string().min(1) });
export const SlackPost = z.object({
  decisionId: z.string().min(1),
  op: z.enum(["tracker", "thread", "archive"]),
  /** thread only */
  teamId: z.string().nullable(), text: z.string().nullable(),
  /** tracker only: fingerprint of the status being posted, so an unchanged tracker is not proposed twice */
  hash: z.string().nullable(),
});
type Slack = ReturnType<typeof slackClient>;
export type Org = { id: string };
const sha = (s: string) => createHash("sha256").update(s).digest("hex").slice(0, 16);

/** Approved campaign_plan -> Campaign node + one CampaignItem and Task per team, then brief.sent for the teams that need a brief (the notification engine routes, delivers and reminds). */
export async function applyCampaignPlan(
  d: { g: Graph; org: Org; now: number; approver: string | null; emitBrief: (e: { decisionId: string; teamId: string; userId: string }) => Promise<unknown>; kickCourier: (decisionId: string) => Promise<unknown> },
  payload: unknown,
) {
  const p = CampaignPlan.parse(payload);
  await query(d.g, `MERGE (c:Campaign {id: $id}) ON CREATE SET c.createdAt = $now, c.status = 'active'
    SET c.decisionId = $decisionId, c.channelName = $channelName, c.channelReason = $channelReason, c.owner = $owner, c.changeDate = $changeDate, c.approvedBy = $by
    WITH c MATCH (dc:Decision {id: $decisionId}) MERGE (c)-[:FOR]->(dc)`,
  { id: p.id, now: d.now, decisionId: p.decisionId, channelName: p.channel?.name ?? null, channelReason: p.channel?.reason ?? null, owner: p.changeOwner, changeDate: p.changeDate, by: d.approver ?? "unknown" });
  for (const t of p.teams) {
    await query(d.g, `MATCH (c:Campaign {id: $id}) MERGE (i:CampaignItem {id: $iid})
      SET i.campaignId = $id, i.teamId = $teamId, i.ownerId = $ownerId, i.dueAt = $dueAt, i.briefNeeded = $briefNeeded, i.accessNeeded = $accessNeeded
      MERGE (c)-[:HAS_ITEM]->(i)
      WITH i OPTIONAL MATCH (o:Person {id: $ownerId}) FOREACH (_ IN CASE WHEN o IS NULL THEN [] ELSE [1] END | MERGE (i)-[:OWNED_BY]->(o))`,
    { id: p.id, iid: `${p.id}-${t.teamId}`, teamId: t.teamId, ownerId: t.ownerId, dueAt: t.dueAt, briefNeeded: t.briefNeeded, accessNeeded: t.accessNeeded });
    if (t.tasks.length) {
      await query(d.g, load("create-tasks").text, { rows: t.tasks.map((k) => ({ id: k.id, teamId: t.teamId, decisionId: p.decisionId, title: k.title, body: "" })), now: d.now });
      await query(d.g, "MATCH (k:Task) WHERE k.id IN $ids SET k.dueAt = $dueAt", { ids: t.tasks.map((k) => k.id), dueAt: t.dueAt });
    }
    if (t.briefNeeded && t.ownerId) await d.emitBrief({ decisionId: p.decisionId, teamId: t.teamId, userId: t.ownerId });
  }
  await d.kickCourier(p.decisionId);
  return { campaignId: p.id, teams: p.teams.map((t) => t.teamId), channel: p.channel?.name ?? null };
}

type CampaignNode = { id: string; status: string; channelName: string | null; channelId: string | null; trackerTs: string | null; trackerHash: string | null; owner: string | null };
export const campaignNode = async (g: Graph, decisionId: string) =>
  (await roQuery<CampaignNode>(g, "MATCH (c:Campaign {decisionId: $id}) RETURN c.id AS id, c.status AS status, c.channelName AS channelName, c.channelId AS channelId, c.trackerTs AS trackerTs, c.trackerHash AS trackerHash, c.owner AS owner", { id: decisionId }))[0] ?? null;

/** Display names for the tracker. */
async function trackerNames(g: Graph, slack?: Slack) {
  const rows = await roQuery<{ id: string; name: string; email: string | null }>(g, "MATCH (n) WHERE n:Team OR n:Person RETURN n.id AS id, n.name AS name, n.email AS email");
  const names = new Map(rows.map((r) => [r.id, r.name]));
  const slackIds = new Map<string, string>();
  if (slack) for (const r of rows) if (r.email) { const u = await slack.userIdByEmail(r.email).catch(() => null); if (u) slackIds.set(r.id, u); }
  return { names, slackIds };
}
export async function trackerText(g: Graph, org: Org, decisionId: string, now: number, slack?: Slack) {
  const s = await campaignStatus(g, org, decisionId, now);
  const { names, slackIds } = await trackerNames(g, slack);
  return { status: s, text: renderTracker(s, names, slackIds) };
}
/** Fingerprint of what the tracker would say (without Slack ids, which do not change the content). */
export const trackerHash = async (g: Graph, org: Org, decisionId: string, now: number) => sha((await trackerText(g, org, decisionId, now)).text);

/** Approved slack_channel_create -> channel, owners invited, tracker posted and pinned, one thread per team. */
export async function createChangeChannel(d: { g: Graph; org: Org; now: number; slack: Slack; saveChannel: (c: { changeId: string; channelId: string; name: string }) => Promise<unknown> }, payload: unknown) {
  const p = SlackChannelCreate.parse(payload);
  const c = await campaignNode(d.g, p.decisionId);
  if (!c || c.id !== p.campaignId) throw new Error("the campaign is not approved yet");
  if (c.channelId) return { channelId: c.channelId, created: false };
  if (!c.channelName) throw new Error("this campaign needs no channel");
  const ch = await createChannel(d.slack, c.channelName);
  const items = await roQuery<{ teamId: string; ownerId: string | null; dueAt: number }>(d.g, "MATCH (:Campaign {id: $id})-[:HAS_ITEM]->(i:CampaignItem) RETURN i.teamId AS teamId, i.ownerId AS ownerId, i.dueAt AS dueAt ORDER BY i.teamId", { id: c.id });
  const owners = [...new Set([...items.map((i) => i.ownerId), c.owner].filter((x): x is string => !!x))];
  const people = await roQuery<{ id: string; email: string | null }>(d.g, "MATCH (p:Person) WHERE p.id IN $ids RETURN p.id AS id, p.email AS email", { ids: owners });
  const slackIds = (await Promise.all(people.map((x) => (x.email ? d.slack.userIdByEmail(x.email) : null)))).filter((x): x is string => !!x);
  await invite(d.slack, ch.id, slackIds);
  const { text } = await trackerText(d.g, d.org, p.decisionId, d.now, d.slack);
  const tracker = await d.slack.postMessage(ch.id, text);
  await pin(d.slack, ch.id, tracker.ts);
  await query(d.g, "MATCH (c:Campaign {id: $id}) SET c.channelId = $ch, c.channelName = $name, c.trackerTs = $ts, c.trackerHash = $hash", { id: c.id, ch: ch.id, name: ch.name, ts: tracker.ts, hash: await trackerHash(d.g, d.org, p.decisionId, d.now) });
  const { names } = await trackerNames(d.g);
  for (const i of items) {
    const t = await d.slack.postMessage(ch.id, `*${names.get(i.teamId) ?? i.teamId}*: owner ${i.ownerId ? (names.get(i.ownerId) ?? i.ownerId) : "none yet"}, due ${new Date(i.dueAt * 1000).toISOString().slice(0, 10)}. Talk about this change in this thread.`);
    await query(d.g, "MATCH (i:CampaignItem {id: $iid}) SET i.threadTs = $ts", { iid: `${c.id}-${i.teamId}`, ts: t.ts });
  }
  await d.saveChannel({ changeId: p.decisionId, channelId: ch.id, name: ch.name });
  return { channelId: ch.id, name: ch.name, invited: slackIds.length, threads: items.length };
}

/** Approved slack_post -> update the pinned tracker (chat.update), post in a team's thread, or close the campaign and archive the channel. */
export async function postToChannel(d: { g: Graph; org: Org; now: number; slack: Slack }, payload: unknown) {
  const p = SlackPost.parse(payload);
  const c = await campaignNode(d.g, p.decisionId);
  if (!c?.channelId) throw new Error("the campaign has no channel yet");
  if (p.op === "thread") {
    const [i] = await roQuery<{ ts: string | null }>(d.g, "MATCH (i:CampaignItem {id: $iid}) RETURN i.threadTs AS ts", { iid: `${c.id}-${p.teamId}` });
    if (!i?.ts || !p.text) throw new Error("no thread for that team");
    const r = await d.slack.postMessage(c.channelId, p.text, { thread_ts: i.ts });
    return { posted: r.ts };
  }
  if (!c.trackerTs) throw new Error("the campaign has no tracker");
  const { text } = await trackerText(d.g, d.org, p.decisionId, d.now, d.slack);
  await updateMessage(d.slack, c.channelId, c.trackerTs, text);
  await query(d.g, "MATCH (c:Campaign {id: $id}) SET c.trackerHash = $hash", { id: c.id, hash: await trackerHash(d.g, d.org, p.decisionId, d.now) });
  if (p.op === "archive") {
    await d.slack.postMessage(c.channelId, "Every team is done. Archiving this channel.");
    await archive(d.slack, c.channelId);
    await query(d.g, "MATCH (c:Campaign {id: $id}) SET c.status = 'closed', c.closedAt = $now", { id: c.id, now: d.now });
    return { archived: c.channelId };
  }
  return { updated: c.trackerTs };
}

export type CourierStep =
  | { action: "none"; reason: "not_approved" | "closed" | "no_channel_needed" | "unchanged" }
  | { action: "slack_channel_create"; payload: z.infer<typeof SlackChannelCreate> }
  | { action: "slack_post"; payload: z.infer<typeof SlackPost> };

/** What the Courier should propose next for a change. Nothing before the campaign is approved (no Campaign node). */
export async function courierNext(g: Graph, org: Org, decisionId: string, now: number): Promise<CourierStep> {
  const c = await campaignNode(g, decisionId);
  if (!c) return { action: "none", reason: "not_approved" };
  if (c.status === "closed") return { action: "none", reason: "closed" };
  if (!c.channelId) return c.channelName ? { action: "slack_channel_create", payload: { decisionId, campaignId: c.id } } : { action: "none", reason: "no_channel_needed" };
  const { status, text } = await trackerText(g, org, decisionId, now); // no Slack ids: the hash must not depend on lookups
  if (status.done) return { action: "slack_post", payload: { decisionId, op: "archive", teamId: null, text: null, hash: null } };
  const hash = sha(text);
  return hash === c.trackerHash ? { action: "none", reason: "unchanged" } : { action: "slack_post", payload: { decisionId, op: "tracker", teamId: null, text: null, hash } };
}
