// @Ripple mentions in channels and DMs: ask the agent as the Slack user's viewer, reply in the thread.
// Pure over `Deps` (interactive.ts), so tests inject mocks. Safety: replies only for the connected workspace, rate limited
// per workspace, the viewer is redacted when the Slack user is unknown, and model output cannot ping anyone.
import type { Deps, InboundJob } from "./interactive";

type Ev = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

/** Break every Slack ping form (<@U..>, <!here>, <!subteam^..>, bare @here/@channel/@everyone) with a zero-width space. */
export function neutralizeSlack(t: string): string {
  return t
    .replace(/<!(here|channel|everyone)(?:\|[^>]*)?>/g, "@​$1")
    .replace(/<!subteam\^[A-Z0-9]+(?:\|([^>]*))?>/g, (_, n) => `@​${String(n ?? "group").replace(/^@/, "")}`)
    .replace(/<@([UW][A-Z0-9]+)(?:\|[^>]*)?>/g, "@​$1")
    .replace(/@(?=(?:here|channel|everyone)\b)/gi, "@​");
}

const hits = new Map<string, { at: number[]; warned: boolean }>();
/** Sliding-window reply limiter per Slack workspace. ponytail: per process; a shared store if workers multiply. */
export function replyGate(teamId: string, now = Date.now(), limit = Number(process.env.SLACK_REPLIES_PER_HOUR) || 30): "ok" | "limited" | "limited-first" {
  const s = hits.get(teamId) ?? { at: [], warned: false };
  s.at = s.at.filter((t) => t > now - 3_600_000);
  if (s.at.length >= limit) {
    const first = !s.warned;
    s.warned = true;
    hits.set(teamId, s);
    return first ? "limited-first" : "limited";
  }
  s.warned = false;
  s.at.push(now);
  hits.set(teamId, s);
  return "ok";
}
export const resetReplyGate = () => hits.clear();

const toMrkdwn = (t: string) => t.replace(/^#{1,6}\s+(.+)$/gm, "**$1**").replace(/\*\*(.+?)\*\*/g, "*$1*");

/** Is this event a human message we should answer? (bots, our own posts, edits and other workspaces are not.) */
export function isAskable(ev: Ev, job: Pick<InboundJob, "teamId">, botUserId: string): boolean {
  if (ev.bot_id || ev.subtype || !ev.user || ev.user === botUserId || !ev.channel || !ev.ts) return false;
  if (ev.user_team && ev.user_team !== job.teamId) return false; // Slack Connect user from another workspace
  if (ev.type === "app_mention") return true;
  return ev.type === "message" && ev.channel_type === "im";
}

/** Reply to an app_mention or a DM in the thread. Returns true when the event was ours to handle. */
export async function handleMention(job: InboundJob, d: Deps): Promise<boolean> {
  const ev = job.data;
  const botUserId = (await d.botUserId?.()) ?? "";
  if (!isAskable(ev, job, botUserId)) return false;
  const thread = String(ev.thread_ts ?? ev.ts);
  const say = (text: string) => d.slack.call("chat.postMessage", { channel: ev.channel, thread_ts: thread, text, unfurl_links: false, unfurl_media: false });

  const gate = replyGate(job.teamId);
  if (gate !== "ok") { if (gate === "limited-first") await say("This workspace has reached Ripple's hourly reply limit. Try again in a little while."); return true; }

  const question = String(ev.text ?? "").replace(/<@[UW][A-Z0-9]+(?:\|[^>]*)?>/g, "").trim();
  if (!question) { await say("Ask me who a change affects, for example `@Ripple who needs to know about the Q4 pricing change?`"); return true; }

  const status = (s: string) => d.slack.call("assistant.threads.setStatus", { channel_id: ev.channel, thread_ts: thread, status: s }).catch(() => undefined); // best effort: only works in assistant threads
  await status("is checking the graph...");
  try {
    const who = await d.asker(ev.user); // unknown email -> no-team viewer, restricted text stays redacted
    let answer = "";
    const sources = new Map<string, string>();
    for await (const e of d.ask(question, await d.graph(), who.viewer)) {
      if (e.type === "text_delta") answer += e.text;
      else if (e.type === "citation") for (const s of e.sources) sources.set(s.artifactId, s.quote);
    }
    const cites = [...sources].slice(0, 8).map(([id, q]) => `• \`${id}\` ${q.replace(/\s+/g, " ").slice(0, 160)}`).join("\n");
    const body = toMrkdwn(answer.trim() || "I could not find that in the graph.") + (cites ? `\n\n*Sources*\n${cites}` : "");
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
