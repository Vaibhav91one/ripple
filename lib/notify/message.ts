// One message shape for every channel (email now, Slack later, in-app): what happened, why it reaches you,
// the quotes, and the actions. Quotes are redacted for the recipient here, so no channel can leak restricted text.
import { encodeAckToken } from "../ack-token";
import { roQuery, type Graph } from "../graph/client";
import { ripple } from "../graph/queries";
import { redact, type Index, type PermViewer } from "../permissions/redact";

export type ActionKind = "ack" | "concern" | "not_relevant" | "open";
export type Message = {
  title: string;
  why: string;
  quotes: { text: string; source: string; url: string }[];
  actions: { kind: ActionKind; url: string }[];
  deepLink: string;
};
/** A quote as read from the graph, before redaction. */
export type RawQuote = { artifactId: string; title: string; quote: string };

export type MessageCtx = {
  orgId: string;
  personId: string;
  /** Epoch seconds. */
  now: number;
  /** e.g. https://ripple.example (no trailing slash). */
  baseUrl?: string;
  /** The delivery row this message goes out on: clicks and acks are recorded on it. */
  deliveryId?: string;
  /** When the notification is about a decision the recipient's team must answer, the ack buttons are added. */
  ack?: { teamId: string; decisionId: string };
  quotes?: RawQuote[];
  /** The recipient, as the permission layer sees them. */
  viewer: PermViewer | undefined;
  index: Index;
};

const TTL = 14 * 86400;
const REPLY = { ack: "seen", concern: "concern", not_relevant: "not_relevant" } as const;

export function buildMessage(
  n: { title: string; body: { reason: string; subject: { kind: string; id: string } } },
  ctx: MessageCtx,
): Message {
  const base = ctx.baseUrl ?? "";
  const { kind, id } = n.body.subject;
  const deepLink = `${base}/items/${encodeURIComponent(kind)}/${encodeURIComponent(id)}`;
  // Redact on the artifact-id shape: a restricted source loses its title and quote text for a non-owner.
  const quotes = redact((ctx.quotes ?? []).map((q) => ({ id: q.artifactId, title: q.title, quote: q.quote })), ctx.viewer, ctx.index)
    .value.map((q) => ({ text: q.quote, source: q.title, url: `${base}/source/${encodeURIComponent(q.id)}` }));
  const token = (r: (typeof REPLY)[keyof typeof REPLY]) =>
    encodeAckToken({ teamId: ctx.ack!.teamId, decisionId: ctx.ack!.decisionId, exp: ctx.now + TTL, o: ctx.orgId, p: ctx.personId, d: ctx.deliveryId, r });
  const actions: Message["actions"] = [
    ...(ctx.ack ? (Object.keys(REPLY) as (keyof typeof REPLY)[]).map((k) => ({ kind: k, url: `${base}/ack/${token(REPLY[k])}?r=${REPLY[k]}` })) : []),
    { kind: "open", url: ctx.deliveryId ? `${base}/r/${ctx.deliveryId}` : deepLink }, // tracked redirect when we know the delivery
  ];
  return { title: n.title, why: n.body.reason, quotes, actions, deepLink };
}

/** The quotes behind one team's part of a decision's ripple, with their artifact titles. Unredacted: pass to buildMessage. */
export async function quotesFor(g: Graph, decisionId: string, teamId: string, now: number): Promise<RawQuote[]> {
  const why = (await ripple(g, decisionId, now)).teams.find((t) => t.teamId === teamId)?.why ?? [];
  const titles = new Map((await roQuery<{ id: string; title: string }>(
    g, "MATCH (a:Artifact) WHERE a.id IN $ids RETURN a.id AS id, a.title AS title", { ids: why.map((w) => w.source.artifactId) },
  )).map((a) => [a.id, a.title]));
  return why.map((w) => ({ artifactId: w.source.artifactId, title: titles.get(w.source.artifactId) ?? w.source.artifactId, quote: w.source.quote }));
}
