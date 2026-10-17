// Slack delivery: Block Kit from the built message (title, why, quotes, 4 buttons), sent as a DM or to the team's channel.
// Button tokens go in `value` (a signed ack token is ~400 chars, over the 255 limit on action_id); action_id is `ripple:<kind>:<n>`.
import type { Adapter, Message, Person } from "../deliver";
import type { Message as Built } from "../message";
import type { slackClient } from "../../connectors/slack/client";

type Client = Pick<ReturnType<typeof slackClient>, "call" | "postMessage" | "userIdByEmail">;
type Block = Record<string, unknown>;

const esc = (s: string) => s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
const LABEL = { ack: "Seen", concern: "Concern", not_relevant: "Not relevant", open: "Open in Ripple" } as const;
const tokenOf = (url: string) => /\/ack\/([^/?#]+)/.exec(url)?.[1] ?? url;

/** Blocks for one built message. The signed token rides in each button's value; `open` is a URL button. */
export function blocksFor(m: Built, n = 0): Block[] {
  const blocks: Block[] = [
    { type: "header", text: { type: "plain_text", text: m.title.slice(0, 150) } },
    { type: "section", text: { type: "mrkdwn", text: `_${esc(m.why)}_` } },
    ...m.quotes.slice(0, 5).map((q) => ({ type: "section", text: { type: "mrkdwn", text: `> ${esc(q.text).slice(0, 1500)}\n<${q.url}|${esc(q.source)}>` } })),
  ];
  blocks.push({
    type: "actions",
    elements: m.actions.map((a) => ({
      type: "button", text: { type: "plain_text", text: LABEL[a.kind] }, action_id: `ripple:${a.kind}:${n}`,
      ...(a.kind === "open" ? { url: a.url } : { value: tokenOf(a.url) }),
    })),
  });
  return blocks;
}

/** Handles slack_dm and slack_channel. A missing Slack user or team channel is a failed delivery, not a silent send. */
export function slackAdapter(c: Client, teamChannel: (personId: string) => string | undefined): Adapter {
  return {
    async send(channel, person: Person, m: Message) {
      let target: string | undefined;
      if (channel === "slack_channel") {
        target = teamChannel(person.id);
        if (!target) return { status: "failed", error: "no Slack channel set for this team" };
      } else {
        if (!person.email) return { status: "failed", error: "no email address to find the Slack user" };
        const user = await c.userIdByEmail(person.email);
        if (!user) return { status: "failed", error: "no Slack user with this email" };
        target = (await c.call<{ channel: { id: string } }>("conversations.open", { users: user })).channel.id;
      }
      const blocks = m.sections?.length ? m.sections.flatMap((s, i) => blocksFor(s, i)) : m.lines.map((l) => ({ type: "section", text: { type: "mrkdwn", text: esc(l) } }));
      const r = await c.postMessage(target, m.subject, { blocks: JSON.stringify(blocks.slice(0, 50)) });
      return { status: "sent", providerId: `${r.channel}:${r.ts}` };
    },
  };
}

/** The org's Slack adapter (installed bot token + per-team channels), or null when Slack isn't connected. */
export async function loadSlackAdapter(orgId: string, teamOf: (personId: string) => string | null | undefined): Promise<Adapter | null> {
  const [{ slackToken, teamChannels }, { decrypt }, { slackClient }] = await Promise.all([
    import("../../connectors/slack/store"), import("../../crypto"), import("../../connectors/slack/client"),
  ]);
  const tokenEnc = await slackToken(orgId);
  if (!tokenEnc) return null;
  const channels = await teamChannels(orgId);
  return slackAdapter(slackClient(decrypt(tokenEnc)), (personId) => channels.get(teamOf(personId) ?? ""));
}
