// The one ack path: /api/ack (web, email link) and Slack buttons both call this. Verify the signed token, record ACKED, mark the delivery, audit.
import { decodeAckToken } from "./ack-token";
import { audit } from "./audit";
import type { Graph } from "./graph/client";
import { recordAck } from "./notify";
import { markDelivery } from "./notify/track";
import type { Ack } from "./schemas";

export type Actor = { personId?: string; auditViewer: { kind: string; id?: string } };
export type AckInput = {
  token: string;
  kind: Ack["kind"];
  /** The token's org -> that org's graph (not the clicker's session). */
  graph: (orgId: string) => Promise<Graph>;
  /** Who actually clicked, given the token's org. A person other than the token's recipient is recorded as `onBehalfOf`. */
  actor?: (orgId: string) => Actor;
  /** Slack: refuse a token minted for another org. */
  expectOrg?: string;
};
export type AckOutcome =
  | { ok: true; orgId: string; teamId: string; decisionId: string; kind: Ack["kind"]; by: string; onBehalfOf?: string; gap: string[] }
  | { ok: false; status: 400 | 410; error: string };

export async function ackFromToken(i: AckInput): Promise<AckOutcome> {
  const t = decodeAckToken(i.token);
  if (t.state === "invalid") return { ok: false, status: 400, error: "invalid token" };
  if (t.state === "expired") return { ok: false, status: 410, error: "token expired" };
  const { teamId, decisionId, o = "demo", p, d } = t.payload;
  if (i.expectOrg && o !== i.expectOrg) return { ok: false, status: 400, error: "invalid token" };
  const g = await i.graph(o);
  const actor = i.actor?.(o);
  const onBehalfOf = actor?.personId && actor.personId !== p ? actor.personId : undefined;
  const { gap, by } = await recordAck(g, { teamId, decisionId, kind: i.kind, by: p, onBehalfOf });
  if (d) await markDelivery(d, "acked"); // no-ops without DATABASE_URL
  await audit(
    { org: { id: o }, viewer: actor?.auditViewer ?? { kind: "anon" } },
    { action: "ack", resourceType: "decision", resourceId: decisionId, meta: { teamId, kind: i.kind, by, onBehalfOf } },
  );
  return { ok: true, orgId: o, teamId, decisionId, kind: i.kind, by, onBehalfOf, gap };
}
