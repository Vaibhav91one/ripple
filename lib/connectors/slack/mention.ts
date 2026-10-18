// @Ripple mentions in channels and DMs: ask the agent as the Slack user's viewer, reply in the thread.
// Pure over `Deps` (interactive.ts), so tests inject mocks. Safety: replies only for the connected workspace, rate limited
// per workspace, the viewer is redacted when the Slack user is unknown, and model output cannot ping anyone.
import { roQuery } from "../../graph/client";
import type { Deps, InboundJob } from "./interactive";

type Ev = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

/** Break every Slack ping form (<@U..>, <!here>, <!subteam^..>, bare @here/@channel/@everyone) with a zero-width space. */
export function neutralizeSlack(t: string): string {
  return t
    .replace(/<(https?:\/\/[^|>]+)\|([^>]+)>/g, (m, url, label) => (/^https?:\/\/([^/]+\.)?slack\.com(\/|$)/i.test(url) ? m : `${label} (${url})`))
    .replace(/<!(here|channel|everyone)(?:\|[^>]*)?>/g, "@​$1")
    .replace(/<!subteam\^[A-Z0-9]+(?:\|([^>]*))?>/g, (_, n) => `@​${String(n ?? "group").replace(/^@/, "")}`)
    .replace(/<@([UW][A-Z0-9]+)(?:\|[^>]*)?>/g, "@​$1")
    .replace(/@(?=(?:here|channel|everyone)\b)/gi, "@​");
}

const hits = new Map<string, { at: number[]; warned: boolean }>();
/** Sliding-window reply limiter per Slack workspace. ponytail: per process; a shared store if workers multiply. */
export function replyGate(key: string, now = Date.now(), limit = Number(process.env.SLACK_REPLIES_PER_HOUR) || 30): "ok" | "limited" | "limited-first" {
  const s = hits.get(key) ?? { at: [], warned: false };
  s.at = s.at.filter((t) => t > now - 3_600_000);
  if (s.at.length >= limit) {
    const first = !s.warned;
    s.warned = true;
    hits.set(key, s);
    return first ? "limited-first" : "limited";
  }
  s.warned = false;
  s.at.push(now);
  hits.set(key, s);
  return "ok";
}
export const resetReplyGate = () => hits.clear();

const toMrkdwn = (t: string) => t.replace(/^#{1,6}\s+(.+)$/gm, "**$1**").replace(/\*\*(.+?)\*\*/g, "*$1*");

/** A full member of the bound workspace: the only Slack user whose email may select a Ripple identity. */
export const isFullMember = (u: { team_id?: string; is_stranger?: boolean; is_restricted?: boolean; is_ultra_restricted?: boolean }, teamId: string) =>
  u.team_id === teamId && !u.is_stranger && !u.is_restricted && !u.is_ultra_restricted;

/** Is this event a human message we should answer? (bots, our own posts, edits and other workspaces are not.) */
export function isAskable(ev: Ev, job: Pick<InboundJob, "teamId">, botUserId: string): boolean {
  if (ev.bot_id || ev.subtype || !ev.user || ev.user === botUserId || !ev.channel || !ev.ts) return false;
  // Slack Connect / other workspace: fail closed on any team id that is not the bound one, and on a shared channel that names no user_team.
  for (const t of [ev.user_team, ev.team, ev.source_team]) if (t && t !== job.teamId) return false;
  if (ev.is_ext_shared_channel && !ev.user_team) return false;
  if (ev.type === "app_mention") return true;
  return ev.type === "message" && ev.channel_type === "im";
}

export const NOTHING_YET = "Ripple hasn't learned about that yet. Connect the repo or Slack channel where it lives and ask me again.";

/** The thread reply (#274): the Assistant's tone, sources by title (never a raw id), a next step when nothing was found. */
export function slackReply(answer: string, sources: Map<string, string>, titles: Map<string, string> = new Map()): string {
  const cites = slackCites(sources, titles);
  return toMrkdwn(answer.trim() || NOTHING_YET) + (cites ? `\n\n*Sources*\n${cites}` : "");
}

export const slackCites = (sources: Map<string, string>, titles: Map<string, string>) =>
  [...sources].slice(0, 8).map(([id, q]) => `• *${titles.get(id) ?? "Source"}*: "${q.replace(/\s+/g, " ").slice(0, 160)}"`).join("\n");

export async function sourceTitles(g: Awaited<ReturnType<Deps["graph"]>>, ids: string[]): Promise<Map<string, string>> {
  const rows = await roQuery<{ id: string; title: string | null }>(g, "MATCH (a:Artifact) WHERE a.id IN $ids RETURN a.id AS id, a.title AS title", { ids });
  return new Map(rows.flatMap((r) => (r.title ? [[r.id, r.title] as const] : [])));
}

/** Reply to an app_mention or a DM in the thread. Returns true when the event was ours to handle. */
export async function handleMention(job: InboundJob, d: Deps): Promise<boolean> {
  const ev = job.data;
  const botUserId = (await d.botUserId?.()) ?? "";
  if (!isAskable(ev, job, botUserId)) return false;
  const thread = String(ev.thread_ts ?? ev.ts);
  const say = (text: string) => d.slack.call("chat.postMessage", { channel: ev.channel, thread_ts: thread, text, unfurl_links: false, unfurl_media: false });

  if (d.primaryAccount && !(await d.primaryAccount())) return true; // several orgs share this workspace: the first-bound one answers, once

  const question = String(ev.text ?? "").replace(/<@[UW][A-Z0-9]+(?:\|[^>]*)?>/g, "").trim().slice(0, 2000);
  if (!question) { await say("Ask me who a change affects, for example `@Ripple who needs to know about the Q4 pricing change?`"); return true; }

  const gate = replyGate(`${job.teamId}:${job.orgId}`);
  if (gate !== "ok") { if (gate === "limited-first") await say("This workspace has reached Ripple's hourly reply limit. Try again in a little while."); return true; }

  const status = (s: string) => d.slack.call("assistant.threads.setStatus", { channel_id: ev.channel, thread_ts: thread, status: s }).catch(() => undefined); // best effort: only works in assistant threads
  await status("is looking it up...");
  try {
    // Channels are visible to everyone in them, so they get the redacted no-team viewer; the mapped viewer only answers in a DM.
    const viewer = ev.channel_type === "im" ? (await d.asker(ev.user)).viewer : { teamIds: [] as string[] };
    let answer = "";
    const sources = new Map<string, string>();
    for await (const e of d.ask(question, await d.graph(), viewer)) {
      if (e.type === "text_delta") answer += e.text;
      else if (e.type === "citation") for (const s of e.sources) sources.set(s.artifactId, s.quote);
    }
    const titles = sources.size ? await sourceTitles(await d.graph(), [...sources.keys()]).catch(() => new Map<string, string>()) : new Map<string, string>();
    const body = slackReply(answer, sources, titles);
    await say(neutralizeSlack(body).slice(0, 3900));
  } catch {
    await say("Sorry, I could not answer that right now.");
  } finally {
    await status("");
  }
  return true;
}

/** member_joined_channel for our own bot: say what to do once. */
export async function handleJoined(job: InboundJob, d: Deps): Promise<void> {
  const ev = job.data;
  if (!ev.channel || ev.user !== (await d.botUserId?.())) return;
  await d.slack.call("chat.postMessage", { channel: ev.channel, text: "Hi, I'm Ripple. Mention me with a question, like `@Ripple who does the Q4 pricing change affect?`, and I'll answer in the thread with sources." });
}
