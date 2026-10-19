// Per-change channel calls (#188). Thin wrappers over the Slack client; the only caller is the slack_channel_create / slack_post executors.
import { SlackError, type slackClient } from "./client";

type Slack = ReturnType<typeof slackClient>;

/** Create `#name` (public); a taken name gets the suffix -2, -3 ... Returns the channel id and the name used. */
export async function createChannel(slack: Slack, name: string): Promise<{ id: string; name: string }> {
  for (let n = 1; ; n++) {
    const tryName = (n === 1 ? name : `${name.slice(0, 78)}-${n}`).slice(0, 80);
    try {
      const r = await slack.call<{ channel: { id: string; name: string } }>("conversations.create", { name: tryName });
      return { id: r.channel.id, name: r.channel.name };
    } catch (e) {
      if (!(e instanceof SlackError && e.code === "name_taken") || n >= 5) throw e;
    }
  }
}

/** Invite people; already-in-channel is fine, an unknown user is skipped. */
export async function invite(slack: Slack, channel: string, userIds: string[]): Promise<void> {
  const users = [...new Set(userIds)];
  if (!users.length) return;
  try {
    await slack.call("conversations.invite", { channel, users: users.join(",") });
  } catch (e) {
    if (!(e instanceof SlackError && ["already_in_channel", "user_not_found"].includes(e.code))) throw e;
  }
}

export const pin = (slack: Slack, channel: string, ts: string) => slack.call("pins.add", { channel, timestamp: ts });
export const updateMessage = (slack: Slack, channel: string, ts: string, text: string) => slack.call("chat.update", { channel, ts, text });
export const archive = (slack: Slack, channel: string) => slack.call("conversations.archive", { channel });
