// One message shape for every channel (email now, Slack later, in-app): what happened, why it reaches you,
// the quotes, and the actions. Quotes are redacted for the recipient here, so no channel can leak restricted text.
import { encodeAckToken } from "../ack-token";
import { roQuery, type Graph } from "../graph/client";
import { ripple } from "../graph/queries";
import { loadIndex, redact, type Index, type PermViewer } from "../permissions/redact";

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

/** The quotes behind a decision's ripple (one team's part, or every team's), with artifact titles. Unredacted: pass to buildMessage. */
export async function quotesFor(g: Graph, decisionId: string, now: number, teamId?: string): Promise<RawQuote[]> {
  const why = (await ripple(g, decisionId, now)).teams.filter((t) => !teamId || t.teamId === teamId).flatMap((t) => t.why);
  const titles = new Map((await roQuery<{ id: string; title: string }>(
    g, "MATCH (a:Artifact) WHERE a.id IN $ids RETURN a.id AS id, a.title AS title", { ids: why.map((w) => w.source.artifactId) },
  )).map((a) => [a.id, a.title]));
  const seen = new Set<string>();
  return why.flatMap((w) => {
    const k = `${w.source.artifactId}|${w.source.quote}`;
    if (seen.has(k)) return [];
    seen.add(k);
    return [{ artifactId: w.source.artifactId, title: titles.get(w.source.artifactId) ?? w.source.artifactId, quote: w.source.quote }];
  });
}

/**
 * Per-org message builder for deliverBatch: loads the permission index and who is on which team once, then builds one
 * message per (notification, delivery) with that recipient's redaction. A decision/change notification to a person
 * with a team gets the ack buttons and the quotes behind the ripple; anything else gets title, why and open.
 */
export async function messageBuilder(g: Graph, o: { baseUrl?: string; now: () => number }) {
  const [index, people] = await Promise.all([
    loadIndex(g),
    roQuery<{ id: string; teamId: string | null }>(g, "MATCH (p:Person) RETURN p.id AS id, p.teamId AS teamId"),
  ]);
  const team = new Map(people.map((p) => [p.id, p.teamId]));
  return async (n: { orgId: string; personId: string; title: string; body: { reason: string; subject: { kind: string; id: string } } }, deliveryId: string) => {
    const teamId = team.get(n.personId) ?? undefined;
    const { kind, id } = n.body.subject;
    const ack = teamId && (kind === "change" || kind === "decision") ? { teamId, decisionId: id } : undefined;
    const quotes = ack ? await quotesFor(g, id, o.now()).catch(() => []) : [];
    return buildMessage(n, { orgId: n.orgId, personId: n.personId, now: o.now(), baseUrl: o.baseUrl, deliveryId, ack, quotes, viewer: { teamIds: teamId ? [teamId] : [] }, index });
  };
}
