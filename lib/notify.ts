// Notify gap teams (brief + Task/NOTIFIES; email + GitHub issue go through the event engine, or direct previews in the DB-less demo) and record acknowledgements.
import type { LanguageModel } from "ai";
import { createElement } from "react";
import { BriefEmail } from "@/components/email/BriefEmail";
import { encodeAckToken } from "./ack-token";
import { env as readEnv } from "./env";
import { buildBrief, claimsBody } from "./briefs";
import { query, roQuery, type Graph } from "./graph/client";
import { detectConflicts, load, ripple } from "./graph/queries";
import { queue } from "./queue";
import { emit } from "./events/emit";
import { createIssue, type GithubEnv } from "./actions/executors";
import { redactForTeam } from "./permissions/redact";
import { sendEmail, type EmailEnv } from "./notify/email";
import type { Ack } from "./schemas";

type Env = EmailEnv & GithubEnv;
// Next rejects a static react-dom/server import in route code; a runtime import by variable name is fine in a route handler.
const SERVER = "react-dom/server";
export const renderHtml = async () => (await import(/* webpackIgnore: true */ SERVER) as typeof import("react-dom/server")).renderToStaticMarkup;
const TTL = 14 * 86400;

export type NotifyResult = {
  teamId: string;
  taskId: string;
  ackUrl: string;
  token: string;
  claims: number;
  email: { status: "sent" | "preview" | "failed" | "queued"; to: string | null; id?: string; error?: string };
  github: { status: "created" | "skipped" | "failed" | "proposed"; url?: string; error?: string };
};

const firstMember = async (g: Graph, teamId: string) =>
  (await roQuery<{ id: string; email: string }>(
    g,
    "MATCH (p:Person)-[:MEMBER_OF]->(:Team {id: $teamId}) RETURN p.id AS id, p.email AS email ORDER BY p.id LIMIT 1",
    { teamId },
  ))[0];

/** Engine path: one brief.sent per gap team (routing, batching, the ledger and reminders take over) and the GitHub issue as a proposed action. */
async function viaEngine(orgId: string, a: { decisionId: string; teamId: string; userId?: string; title: string; body: string }): Promise<Pick<NotifyResult, "email" | "github">> {
  try {
    const [{ db }, { propose }] = await Promise.all([import("./db"), import("./actions/propose")]);
    let email: NotifyResult["email"] = { status: "failed", to: null, error: "team has no member to notify" };
    if (a.userId) {
      await emit(db(), {
        type: "brief.sent", orgId, subject: { kind: "decision", id: a.decisionId }, payload: { briefId: `brief-${a.decisionId}-${a.teamId}`, userId: a.userId },
        dedupeKey: `brief.sent:${a.decisionId}:${a.teamId}`,
      });
      email = { status: "queued", to: null };
    }
    await propose({ org: { id: orgId }, viewer: { kind: "system" } }, "create_issue", { title: a.title, body: a.body });
    return { email, github: { status: "proposed" } };
  } catch (e) {
    return { email: { status: "failed", to: null, error: String(e) }, github: { status: "failed", error: String(e) } };
  }
}

export async function notifyGaps(
  g: Graph, decisionId: string,
  o: { orgId?: string; now?: number; baseUrl?: string; env?: Env; model?: LanguageModel | null } = {},
): Promise<NotifyResult[]> {
  const now = o.now ?? Math.floor(Date.now() / 1000);
  const env = o.env ?? readEnv();
  const baseUrl = o.baseUrl ?? "";
  const detected = await detectConflicts(g, now, decisionId); // ripple() only reads stored conflicts
  if (o.orgId) await (await import("./events/conflicts")).emitConflictsFound(o.orgId, detected);
  const r = await ripple(g, decisionId, now);
  const teamName = (id: string) => r.nodes.find((n) => n.id === id)?.label ?? id;
  const results: NotifyResult[] = [];
  const orgId = o.orgId ?? "demo";
  const engine = !!readEnv().DATABASE_URL; // no Postgres (the demo): keep the direct preview path

  for (const teamId of r.gap) {
    const built = await buildBrief(teamId, decisionId, { g, now, rippleResult: r, model: o.model });
    const brief = await redactForTeam(g, teamId, built); // the recipient team is the viewer: other teams' quotes read "restricted to <Team>" (#142)
    const member = await firstMember(g, teamId);
    const token = encodeAckToken({ teamId, decisionId, exp: now + TTL, o: orgId, p: member?.id });
    const taskId = `task-${decisionId}-${teamId}`;
    const title = `Review: ${r.decision.title}`;
    const refs = new Set(r.teams.find((t) => t.teamId === teamId)?.why.map((w) => w.ref));
    const found = r.conflicts.find((c) => c.contractIds.some((id) => refs.has(id)));
    const conflict = found && await redactForTeam(g, teamId, found);
    const titles = new Map((await redactForTeam(g, teamId, await roQuery<{ id: string; title: string }>(
      g, "MATCH (a:Artifact) WHERE a.id IN $ids RETURN a.id AS id, a.title AS title",
      { ids: [...brief.claims, ...(conflict ? [conflict] : [])].flatMap((c) => c.sources.map((s) => s.artifactId)) },
    ))).map((a) => [a.id, a.title]));
    const html = (await renderHtml())(createElement(BriefEmail, {
      brief, teamName: teamName(teamId), decisionTitle: r.decision.title, conflict, token, baseUrl,
      sourceTitle: (id: string) => titles.get(id) ?? id,
    }));
    const subject = `Ripple: ${r.decision.title} affects ${teamName(teamId)}`;

    const body = claimsBody(brief.claims);
    await query(g, load("create-tasks").text, { rows: [{ id: taskId, teamId, decisionId, title, body }], now });

    const ack = body + `\n\nAcknowledge: ${baseUrl}/ack/${token}`;
    const sent = engine ? await viaEngine(orgId, { decisionId, teamId, userId: member?.id, title, body: ack }) : null;
    const email = sent?.email ?? await sendEmail(env, member?.email ?? null, subject, html);
    const github = sent?.github ?? await createIssue(env, title, ack);

    await query(g, `MERGE (o:Outbox {id: $id})
      SET o.teamId = $teamId, o.decisionId = $decisionId, o.to = $to, o.subject = $subject, o.html = $html,
          o.status = $status, o.at = $now`,
    { id: `out-${decisionId}-${teamId}`, teamId, decisionId, to: member?.email ?? "", subject, html, status: email.status, now });

    results.push({ teamId, taskId, token, ackUrl: `${baseUrl}/ack/${token}`, claims: brief.claims.length, email, github });
  }
  return results;
}

/** A team ack ends the 48h/96h reminders of every member. Best effort: no queue (no DATABASE_URL) or a failure never blocks the ack. */
async function cancelPendingReminders(g: Graph, teamId: string, changeId: string) {
  try {
    const q = queue();
    if (!q) return;
    const boss = await q; // before the graph read: a rejected start must not sit unhandled meanwhile
    const members = await roQuery<{ id: string }>(g, "MATCH (p:Person)-[:MEMBER_OF]->(:Team {id: $teamId}) RETURN p.id AS id", { teamId });
    const { cancelReminders } = await import("./notify/reminders");
    await cancelReminders(boss, changeId, members.map((m) => m.id));
  } catch (e) {
    console.error("[notify] cancel reminders failed:", String(e));
  }
}

/** Write ACKED {kind, by, at} from team to decision; returns the new gap. Idempotent per team+decision. */
export async function recordAck(
  g: Graph, a: { teamId: string; decisionId: string; kind: Ack["kind"]; by?: string; onBehalfOf?: string }, now = Math.floor(Date.now() / 1000),
): Promise<{ gap: string[]; by: string }> {
  const by = a.by ?? (await firstMember(g, a.teamId))?.id ?? "unknown";
  await query(g, `MATCH (t:Team {id: $teamId}), (d:Decision {id: $decisionId})
    MERGE (t)-[r:ACKED]->(d)
    SET r.kind = $kind, r.by = $by, r.onBehalfOf = $onBehalfOf, r.at = $now, r.valid_from = $now, r.valid_to = null`, { teamId: a.teamId, decisionId: a.decisionId, kind: a.kind, by, onBehalfOf: a.onBehalfOf ?? null, now });
  await cancelPendingReminders(g, a.teamId, a.decisionId);
  return { gap: (await ripple(g, a.decisionId, now)).gap, by };
}
