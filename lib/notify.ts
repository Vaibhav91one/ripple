// Notify gap teams (brief + Task/NOTIFIES + email + GitHub issue) and record acknowledgements.
import { createSign } from "node:crypto";
import type { LanguageModel } from "ai";
import { createElement } from "react";
import { Resend } from "resend";
import { BriefEmail } from "@/components/email/BriefEmail";
import { encodeAckToken } from "./ack-token";
import { env as readEnv, type Env as AppEnv } from "./env";
import { buildBrief, claimsBody } from "./briefs";
import { query, roQuery, type Graph } from "./graph/client";
import { detectConflicts, load, ripple } from "./graph/queries";
import type { Ack } from "./schemas";

type Env = Partial<Pick<AppEnv, "RESEND_API_KEY" | "RESEND_FROM" | "GITHUB_APP_ID" | "GITHUB_APP_INSTALLATION_ID" | "GITHUB_APP_PRIVATE_KEY" | "GITHUB_REPO">>;
// Next rejects a static react-dom/server import in route code; a runtime import by variable name is fine in a route handler.
const SERVER = "react-dom/server";
const renderHtml = async () => (await import(/* webpackIgnore: true */ SERVER) as typeof import("react-dom/server")).renderToStaticMarkup;
const TTL = 14 * 86400;

export type NotifyResult = {
  teamId: string;
  taskId: string;
  ackUrl: string;
  token: string;
  claims: number;
  email: { status: "sent" | "preview" | "failed"; to: string | null; id?: string; error?: string };
  github: { status: "created" | "skipped" | "failed"; url?: string; error?: string };
};

const firstMember = async (g: Graph, teamId: string) =>
  (await roQuery<{ id: string; email: string }>(
    g,
    "MATCH (p:Person)-[:MEMBER_OF]->(:Team {id: $teamId}) RETURN p.id AS id, p.email AS email ORDER BY p.id LIMIT 1",
    { teamId },
  ))[0];

async function sendEmail(env: Env, to: string | null, subject: string, html: string): Promise<NotifyResult["email"]> {
  if (!env.RESEND_API_KEY || !env.RESEND_FROM || !to) return { status: "preview", to };
  try {
    const { data, error } = await new Resend(env.RESEND_API_KEY).emails.send({ from: env.RESEND_FROM, to, subject, html });
    return error ? { status: "failed", to, error: error.message } : { status: "sent", to, id: data?.id };
  } catch (e) {
    return { status: "failed", to, error: String(e) };
  }
}

/** GitHub App: RS256 JWT -> installation token -> create issue in GITHUB_REPO (owner/name). */
async function createIssue(env: Env, title: string, body: string): Promise<NotifyResult["github"]> {
  const { GITHUB_APP_ID: app, GITHUB_APP_INSTALLATION_ID: inst, GITHUB_APP_PRIVATE_KEY: pem, GITHUB_REPO: repo } = env;
  if (!app || !inst || !pem || !repo) return { status: "skipped" };
  try {
    const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
    const iat = Math.floor(Date.now() / 1000);
    const unsigned = `${b64({ alg: "RS256", typ: "JWT" })}.${b64({ iat: iat - 60, exp: iat + 540, iss: app })}`;
    const jwt = `${unsigned}.${createSign("RSA-SHA256").update(unsigned).sign(pem.replaceAll("\\n", "\n"), "base64url")}`;
    const h = (t: string) => ({ authorization: `Bearer ${t}`, accept: "application/vnd.github+json", "x-github-api-version": "2022-11-28" });
    const tok = await fetch(`https://api.github.com/app/installations/${inst}/access_tokens`, { method: "POST", headers: h(jwt) });
    if (!tok.ok) return { status: "failed", error: `installation token: ${tok.status}` };
    const { token } = (await tok.json()) as { token: string };
    const res = await fetch(`https://api.github.com/repos/${repo}/issues`, {
      method: "POST", headers: { ...h(token), "content-type": "application/json" }, body: JSON.stringify({ title, body }),
    });
    if (!res.ok) return { status: "failed", error: `create issue: ${res.status}` };
    return { status: "created", url: ((await res.json()) as { html_url: string }).html_url };
  } catch (e) {
    return { status: "failed", error: String(e) };
  }
}

export async function notifyGaps(
  g: Graph, decisionId: string,
  o: { orgId?: string; now?: number; baseUrl?: string; env?: Env; model?: LanguageModel | null } = {},
): Promise<NotifyResult[]> {
  const now = o.now ?? Math.floor(Date.now() / 1000);
  const env = o.env ?? readEnv();
  const baseUrl = o.baseUrl ?? "";
  await detectConflicts(g, now, decisionId); // ripple() only reads stored conflicts
  const r = await ripple(g, decisionId, now);
  const teamName = (id: string) => r.nodes.find((n) => n.id === id)?.label ?? id;
  const results: NotifyResult[] = [];

  for (const teamId of r.gap) {
    const brief = await buildBrief(teamId, decisionId, { g, now, rippleResult: r, model: o.model });
    const member = await firstMember(g, teamId);
    const token = encodeAckToken({ teamId, decisionId, exp: now + TTL, o: o.orgId ?? "demo", p: member?.id });
    const taskId = `task-${decisionId}-${teamId}`;
    const title = `Review: ${r.decision.title}`;
    const refs = new Set(r.teams.find((t) => t.teamId === teamId)?.why.map((w) => w.ref));
    const conflict = r.conflicts.find((c) => c.contractIds.some((id) => refs.has(id)));
    const titles = new Map((await roQuery<{ id: string; title: string }>(
      g, "MATCH (a:Artifact) WHERE a.id IN $ids RETURN a.id AS id, a.title AS title",
      { ids: [...brief.claims, ...(conflict ? [conflict] : [])].flatMap((c) => c.sources.map((s) => s.artifactId)) },
    )).map((a) => [a.id, a.title]));
    const html = (await renderHtml())(createElement(BriefEmail, {
      brief, teamName: teamName(teamId), decisionTitle: r.decision.title, conflict, token, baseUrl,
      sourceTitle: (id: string) => titles.get(id) ?? id,
    }));
    const subject = `Ripple: ${r.decision.title} affects ${teamName(teamId)}`;

    const body = claimsBody(brief.claims);
    await query(g, load("create-tasks").text, { rows: [{ id: taskId, teamId, decisionId, title, body }], now });

    const email = await sendEmail(env, member?.email ?? null, subject, html);
    const github = await createIssue(env, title, body + `\n\nAcknowledge: ${baseUrl}/ack/${token}`);

    await query(g, `MERGE (o:Outbox {id: $id})
      SET o.teamId = $teamId, o.decisionId = $decisionId, o.to = $to, o.subject = $subject, o.html = $html,
          o.status = $status, o.at = $now`,
    { id: `out-${decisionId}-${teamId}`, teamId, decisionId, to: member?.email ?? "", subject, html, status: email.status, now });

    results.push({ teamId, taskId, token, ackUrl: `${baseUrl}/ack/${token}`, claims: brief.claims.length, email, github });
  }
  return results;
}

/** Write ACKED {kind, by, at} from team to decision; returns the new gap. Idempotent per team+decision. */
export async function recordAck(
  g: Graph, a: { teamId: string; decisionId: string; kind: Ack["kind"]; by?: string }, now = Math.floor(Date.now() / 1000),
): Promise<{ gap: string[]; by: string }> {
  const by = a.by ?? (await firstMember(g, a.teamId))?.id ?? "unknown";
  await query(g, `MATCH (t:Team {id: $teamId}), (d:Decision {id: $decisionId})
    MERGE (t)-[r:ACKED]->(d)
    SET r.kind = $kind, r.by = $by, r.at = $now, r.valid_from = $now, r.valid_to = null`, { teamId: a.teamId, decisionId: a.decisionId, kind: a.kind, by, now });
  return { gap: (await ripple(g, a.decisionId, now)).gap, by };
}
