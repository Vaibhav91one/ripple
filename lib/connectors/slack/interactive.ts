// The slack-inbound consumer: button presses (ack / concern / not relevant), the 'Save to Ripple' message shortcut,
// /ripple <question> and /ripple decision <text>. The routes already answered 200 within 3s; the replies go through response_url.
// Everything outside the logic (Slack, graph, model, pipeline) is injected, so tests run with mocks.
import { ackFromToken, type AckOutcome } from "../../ack";
import type { Graph } from "../../graph/client";
import type { PermViewer } from "../../permissions/redact";
import type { StreamEvent } from "../../schemas";
import { NOTHING_YET, slackCites, sourceTitles } from "./mention";

export type InboundJob = { kind: "events" | "interactive" | "command"; accountId: string; orgId: string; teamId: string; data: Record<string, any> }; // eslint-disable-line @typescript-eslint/no-explicit-any
/** A Slack `message` event (the evidence connector, #177, consumes these). */
export type MessageEventPayload = { orgId: string; accountId: string; teamId: string; event: Record<string, any> }; // eslint-disable-line @typescript-eslint/no-explicit-any
export type Asker = { personId?: string; viewer: PermViewer };
export type Deps = {
  graph: () => Promise<Graph>;
  slack: { call: <T = Record<string, unknown>>(method: string, params?: Record<string, string | number | boolean>) => Promise<T> };
  /** POST JSON to a Slack response_url. */
  respond: (url: string, body: Record<string, unknown>) => Promise<void>;
  /** Slack user -> Person (by email) -> membership viewer. Unmapped = no teams, so every restricted payload stays redacted. */
  asker: (slackUserId: string) => Promise<Asker>;
  /** Store the text as a document, run the C2 pipeline, return how many proposals it produced. */
  ingest: (i: { source: "doc" | "message"; title: string; text: string; ref?: string }) => Promise<{ proposals: number; duplicate: boolean }>;
  /** Run Ask as this viewer. */
  ask: (question: string, g: Graph, viewer: PermViewer) => AsyncIterable<StreamEvent>;
  /** change_channel lookup: the change a Slack channel belongs to, null when there is no row. */
  changeForChannel: (channelId: string) => Promise<string | null>;
  /** Evidence from every `message` event (#177, wired in #199). */
  onMessageEvent: (p: MessageEventPayload) => Promise<void>;
  /** Our bot's Slack user id (auth.test), to ignore our own posts. Optional: without it only bot_id/subtype filtering applies. */
  /** False when several orgs bound this workspace and this job is not the first-bound one: only that one answers. */
  primaryAccount?: () => Promise<boolean>;
  botUserId?: () => Promise<string>;
};

const ACK_KIND = { ack: "seen", concern: "concern", not_relevant: "not_relevant" } as const;
const DONE = { ack: "Acknowledged", concern: "Concern raised", not_relevant: "Marked not relevant" } as const;
const section = (text: string) => ({ type: "section", text: { type: "mrkdwn", text } });

/** The change whose room this channel is: the stored change_channel row, else (legacy, no row) a channel named chg-<id>. Only returns changes that exist. */
export async function changeOfChannel(d: Deps, channel: string): Promise<string | undefined> {
  let id = (await d.changeForChannel(channel)) ?? undefined;
  if (!id) { // name fallback only when no row exists: names can be renamed, so a row always wins
    const name = (await d.slack.call<{ channel: { name: string } }>("conversations.info", { channel }).catch(() => null))?.channel.name;
    id = name?.match(/^chg-(.+)$/)?.[1];
  }
  if (!id) return undefined;
  const { roQuery } = await import("../../graph/client");
  const rows = await roQuery<{ id: string }>(await d.graph(), "MATCH (d:Decision {id: $id}) RETURN d.id AS id", { id });
  return rows[0]?.id;
}

async function onAction(job: InboundJob, d: Deps) {
  const p = job.data;
  const a = (p.actions ?? []).find((x: { action_id?: string }) => /^ripple:(ack|concern|not_relevant):/.test(x.action_id ?? ""));
  if (!a || !p.response_url) return; // 'Open in Ripple' is a URL button; anything else isn't ours
  const kind = a.action_id.split(":")[1] as keyof typeof ACK_KIND;
  const who = await d.asker(p.user.id);
  const r: AckOutcome = await ackFromToken({
    token: String(a.value ?? ""), kind: ACK_KIND[kind], expectOrg: job.orgId, graph: () => d.graph(),
    actor: () => ({ personId: who.personId, auditViewer: { kind: "slack", id: p.user.id } }),
  });
  if (!r.ok) return d.respond(p.response_url, { response_type: "ephemeral", replace_original: false, text: r.status === 410 ? "This link has expired. Open Ripple to respond." : "Could not verify this button." });
  const line = `${DONE[kind]} by <@${p.user.id}>${r.onBehalfOf ? " on behalf of the team" : ""}`;
  const kept = ((p.message?.blocks ?? []) as { type: string }[]).filter((b) => b.type !== "actions");
  await d.respond(p.response_url, {
    replace_original: true, text: line,
    blocks: [...kept, { type: "context", elements: [{ type: "mrkdwn", text: line }] }].slice(0, 50),
  });
}

async function onSaveToRipple(job: InboundJob, d: Deps) {
  const p = job.data;
  const text = String(p.message?.text ?? "").trim();
  const say = (t: string) => d.respond(p.response_url, { response_type: "ephemeral", text: t });
  if (!text) return say("That message has no text to save.");
  const permalink = (await d.slack.call<{ permalink: string }>("chat.getPermalink", { channel: p.channel.id, message_ts: p.message.ts }).catch(() => null))?.permalink;
  const change = await changeOfChannel(d, p.channel.id);
  const r = await d.ingest({
    source: "message", title: `Slack message${change ? ` on ${change}` : ""}`,
    text: change ? `Change ${change}. ${text}` : text, ref: permalink,
  });
  await say(r.duplicate ? "Already saved to Ripple." : `Saved — ${r.proposals} edges proposed`);
}

async function onCommand(job: InboundJob, d: Deps) {
  const p = job.data;
  const say = (body: Record<string, unknown>) => d.respond(p.response_url, { response_type: "ephemeral", ...body });
  const text = String(p.text ?? "").trim();
  if (!text) return say({ text: "Usage: `/ripple <question>` or `/ripple decision <text>`" });

  const decision = text.match(/^decision\s+([\s\S]+)/i)?.[1];
  if (decision) {
    const change = await changeOfChannel(d, p.channel_id);
    if (!change) return say({ text: "Run `/ripple decision` inside a #chg- channel so I know which change it belongs to." });
    const r = await d.ingest({ source: "doc", title: `Decision note on ${change}`, text: `Decision note on change ${change} (recorded by <@${p.user_id}>): ${decision}`, ref: `slack:decision:${p.trigger_id}` });
    return d.respond(p.response_url, { response_type: "in_channel", text: r.duplicate ? "That decision is already recorded." : `Decision recorded on ${change} — ${r.proposals} edges proposed` });
  }

  const who = await d.asker(p.user_id);
  let answer = "";
  const sources = new Map<string, string>();
  for await (const ev of d.ask(text, await d.graph(), who.viewer)) {
    if (ev.type === "text_delta") answer += ev.text;
    else if (ev.type === "citation") for (const s of ev.sources) sources.set(s.artifactId, s.quote);
  }
  const titles = sources.size ? await sourceTitles(await d.graph(), [...sources.keys()]).catch(() => new Map<string, string>()) : new Map<string, string>();
  const cites = slackCites(sources, titles);
  await d.respond(p.response_url, {
    response_type: "in_channel",
    text: answer.trim() || NOTHING_YET,
    blocks: [section(answer.trim() || NOTHING_YET), ...(cites ? [section(`*Sources*\n${cites}`)] : [])],
  });
}

export async function handleInbound(job: InboundJob, d: Deps): Promise<void> {
  if (job.kind === "events") {
    const t = job.data.type;
    if (t === "app_mention" || (t === "message" && job.data.channel_type === "im")) { await (await import("./mention")).handleMention(job, d); return; }
    if (t === "member_joined_channel") { await (await import("./mention")).handleJoined(job, d); return; }
    if (t === "message") await d.onMessageEvent({ orgId: job.orgId, accountId: job.accountId, teamId: job.teamId, event: job.data });
    return;
  }
  const p = job.data;
  if (job.kind === "command") {
    if (p.command === "/ripple") await onCommand(job, d);
    return;
  }
  if (p.type === "block_actions") await onAction(job, d);
  else if (p.type === "message_action" && p.callback_id === "save_to_ripple") await onSaveToRipple(job, d);
}
