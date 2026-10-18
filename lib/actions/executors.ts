// Action executors: the only code that performs a side effect on behalf of an agent. kind -> (payload, ctx) => result.
// Later connector issues add send_slack, send_email, pr_comment, ...
import { z } from "zod";
import { env, type Env } from "../env";
import { query, type Graph } from "../graph/client";
import { load } from "../graph/queries";
import type { ActionKind } from "../agent/define";
import { applyProposal } from "../connectors/apply";
import { githubApp } from "../connectors/github/client";
import { githubEnv } from "../connectors/github/app-creds";
import { postComment } from "../connectors/github/mention";
import type { Octo } from "../connectors/github/sync";
import { safeMessage } from "../log";

/** approver: who approved the action (user id or "policy"). runId: the agent run that proposed it. */
export type ActionCtx = { org: { id: string }; now: number; writer: () => Graph; approver?: string | null; runId?: string | null };

export const CreateTask = z.object({ id: z.string().min(1), teamId: z.string().min(1), decisionId: z.string().min(1), title: z.string().min(1), body: z.string() });
// Labels are interpolated into Cypher, so they come from this list only.
export const GraphMerge = z.object({
  label: z.enum(["Task", "Person", "Team", "System"]),
  id: z.string().min(1),
  props: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).refine((p) => !("id" in p), "props.id is not allowed").default({}),
});

// notice/amendment answer a contract (Legal); email/talk_track answer a customer (Sales and CS, Customer Exposure);
// docs_change/faq/reply_macro/audit_note are the team specialists' drafts (Docs, Support, Security).
export const DraftDoc = z.object({
  kind: z.enum(["notice", "amendment", "email", "talk_track", "docs_change", "faq", "reply_macro", "audit_note"]),
  contractId: z.string().min(1).nullish(), customerId: z.string().min(1).nullish(), pageId: z.string().min(1).nullish(),
  decisionId: z.string().min(1), title: z.string().min(1), body: z.string().min(1),
}).refine((d) => (d.kind === "email" || d.kind === "talk_track" ? !!d.customerId : d.kind === "notice" || d.kind === "amendment" ? !!d.contractId : true), "a contract draft needs contractId, a customer draft needs customerId");
/** Drafts that quote restricted text stay with the owning team. Docs, FAQ and macros are open. */
const draftOwner = (d: z.infer<typeof DraftDoc>) => (d.kind === "audit_note" ? "security" : d.kind === "email" || d.kind === "talk_track" ? "sales" : d.kind === "notice" || d.kind === "amendment" ? "legal" : null);

export const AccessRequest = z.object({
  id: z.string().min(1), personId: z.string().min(1), teamId: z.string().nullable(), resourceId: z.string().min(1), resourceKind: z.enum(["group", "software"]),
  decisionId: z.string().min(1), justification: z.string().min(1), src: z.string().nullable(), quote: z.string().nullable(),
  expiresAt: z.number().int(), approvers: z.array(z.string().min(1)).min(1),
});

/** Approved access_request -> an open AccessRequest node for the /it queue + access.needed. Ripple never grants access: IT does, elsewhere, then marks it on /it. */
async function openAccessRequest(payload: unknown, { org, writer, now }: ActionCtx) {
  const p = AccessRequest.parse(payload);
  await query(writer(), load("access-request-create").text, { ...p, now });
  const [{ db }, { emit }] = await Promise.all([import("../db"), import("../events/emit")]); // lazy: lib/db is server-only
  await emit(db(), { type: "access.needed", orgId: org.id, subject: { kind: "access_request", id: p.id }, payload: { userId: p.personId, resource: p.resourceId }, dedupeKey: `access.needed:${p.id}` });
  return { accessRequestId: p.id, personId: p.personId, resourceId: p.resourceId };
}

/** Approved draft -> `document` row (deduped by content per org) + a Doc:Artifact node ABOUT the contract or page and the decision. Notices and amendments are Legal-only on read, audit notes Security-only (restrictedTo). Returns the document id. */
async function saveDraft(payload: unknown, { org, writer, now, approver, runId }: ActionCtx) {
  const p = DraftDoc.parse(payload);
  const { db } = await import("../db"); // lazy: keeps lib/db (server-only) out of the pure-executor import graph
  const { documents, agentRuns } = await import("../db/schema");
  const { and, eq } = await import("drizzle-orm");
  const { createHash } = await import("node:crypto");
  const sha256 = createHash("sha256").update(p.body).digest("hex");
  const run = runId ? (await db().select({ agent: agentRuns.agent }).from(agentRuns).where(eq(agentRuns.id, runId)))[0] : undefined;
  const [ins] = await db().insert(documents).values({ orgId: org.id, sourceKind: "doc", sourceRef: `draft:${p.kind}:${p.contractId ?? p.customerId ?? p.pageId ?? p.decisionId}`, title: p.title, text: p.body, sha256 })
    .onConflictDoNothing({ target: [documents.orgId, documents.sha256] }).returning({ id: documents.id });
  const id = ins?.id ?? (await db().select({ id: documents.id }).from(documents).where(and(eq(documents.orgId, org.id), eq(documents.sha256, sha256))))[0].id;
  await query(writer(), `MERGE (a:Doc:Artifact {id: $id})
    SET a.kind = 'doc', a.title = $title, a.text = $text, a.ts = $now, a.uri = '', a.author = $author, a.approvedBy = $approvedBy, a.draftKind = $draftKind, a.restrictedTo = $owner
    WITH a
    OPTIONAL MATCH (c:Contract {id: $contractId})
    OPTIONAL MATCH (cu:Customer {id: $customerId})
    OPTIONAL MATCH (pg:Page {id: $pageId})
    OPTIONAL MATCH (d:Decision {id: $decisionId})
    FOREACH (_ IN CASE WHEN cu IS NULL THEN [] ELSE [1] END | MERGE (a)-[r:ABOUT]->(cu) SET r.valid_from = $now, r.valid_to = null, r.observed_at = $now)
    FOREACH (_ IN CASE WHEN pg IS NULL THEN [] ELSE [1] END | MERGE (a)-[r:ABOUT]->(pg) SET r.valid_from = $now, r.valid_to = null, r.observed_at = $now)
    FOREACH (_ IN CASE WHEN c IS NULL THEN [] ELSE [1] END | MERGE (a)-[r:ABOUT]->(c) SET r.valid_from = $now, r.valid_to = null, r.observed_at = $now)
    FOREACH (_ IN CASE WHEN d IS NULL THEN [] ELSE [1] END | MERGE (a)-[r:ABOUT]->(d) SET r.valid_from = $now, r.valid_to = null, r.observed_at = $now)`,
  { id, title: p.title, text: p.body, now, author: `agent:${run?.agent ?? "unknown"}`, approvedBy: approver ?? "unknown", draftKind: p.kind, contractId: p.contractId ?? null, customerId: p.customerId ?? null, pageId: p.pageId ?? null, decisionId: p.decisionId, owner: draftOwner(p) });
  return { documentId: id, kind: p.kind, contractId: p.contractId ?? null, customerId: p.customerId ?? null, pageId: p.pageId ?? null, decisionId: p.decisionId };
}

export const SuggestMerge = z.object({
  op: z.literal("suggest_merge"), kind: z.enum(["Person", "Team", "System", "Customer"]), aliasNorm: z.string().min(1), nodeId: z.string().min(1),
  mention: z.string(), score: z.number(), newId: z.string(), src: z.string().optional(), quote: z.string().optional(),
});

export type GithubEnv = Partial<Pick<Env, "GITHUB_APP_ID" | "GITHUB_APP_INSTALLATION_ID" | "GITHUB_APP_PRIVATE_KEY" | "GITHUB_APP_WEBHOOK_SECRET" | "GITHUB_REPO">>;
export const CreateIssue = z.object({ title: z.string().min(1), body: z.string() });

/** GitHub App installation client (@octokit/app caches the installation token) -> create issue in GITHUB_REPO (owner/name). */
export async function createIssue(e: GithubEnv, title: string, body: string): Promise<{ status: "created" | "skipped" | "failed"; url?: string; error?: string }> {
  const app = githubApp(e);
  const [owner, name] = (e.GITHUB_REPO ?? "").split("/");
  if (!app || !e.GITHUB_APP_INSTALLATION_ID || !owner || !name) return { status: "skipped" };
  try {
    const o = await app.getInstallationOctokit(Number(e.GITHUB_APP_INSTALLATION_ID));
    const res = await o.request("POST /repos/{owner}/{repo}/issues", { owner, repo: name, title, body });
    return { status: "created", url: res.data.html_url };
  } catch (err) {
    return { status: "failed", error: safeMessage(err) };
  }
}

/** The installation id the org connected, or undefined (then GITHUB_APP_INSTALLATION_ID applies). */
async function orgInstallation(orgId: string): Promise<string | undefined> {
  const [{ db }, { connectorAccounts }, { and, eq }, { decrypt }] = await Promise.all([import("../db"), import("../db/schema"), import("drizzle-orm"), import("../crypto")]);
  const [acct] = await db().select({ t: connectorAccounts.tokenEnc }).from(connectorAccounts).where(and(eq(connectorAccounts.orgId, orgId), eq(connectorAccounts.kind, "github"))).limit(1);
  return acct?.t ? decrypt(acct.t) : undefined;
}

export const PrComment = z.object({ repo: z.string().regex(/^[^/\s]+\/[^/\s]+$/, "repo must be owner/name"), number: z.number().int().positive(), body: z.string().min(1) });

/** Approved pr_comment -> a comment on that PR (or issue) as the GitHub App. Installation = the org's connected one, else GITHUB_APP_INSTALLATION_ID. */
export async function prComment(e: GithubEnv, installation: string | undefined, p: z.infer<typeof PrComment>): Promise<{ status: "created" | "skipped"; url?: string }> {
  const app = githubApp(e);
  const id = installation ?? e.GITHUB_APP_INSTALLATION_ID;
  if (!app || !id) return { status: "skipped" };
  const octo = (await app.getInstallationOctokit(Number(id))) as unknown as Octo;
  const res = await postComment(octo, p.repo, p.number, p.body);
  return { status: "created", url: (res.data as { html_url?: string }).html_url };
}

/** Agent memory (#210): one conclusion, linked ABOUT every entity it concerns. */
export const RecordFinding = z.object({
  id: z.string().min(1), text: z.string().min(1), entityIds: z.array(z.string().min(1)).min(1), sources: z.array(z.string()),
  confidence: z.number().min(0).max(1), supersedes: z.array(z.string()),
});

const agentOf = async (runId: string) => {
  const [{ db }, { agentRuns }, { eq }] = await Promise.all([import("../db"), import("../db/schema"), import("drizzle-orm")]); // lazy: lib/db is server-only
  return (await db().select({ agent: agentRuns.agent }).from(agentRuns).where(eq(agentRuns.id, runId)))[0]?.agent ?? "unknown";
};

/** Approved record_finding -> an :AgentFinding node ABOUT its entities. A finding resting on restricted sources or entities keeps their owner (restrictedTo), so it stays invisible to every other team.
 *  Distinct label: `Finding` is the Security team's restricted finding (classify.ts), and reusing it would make agent notes Security-only and leak into its pages. ponytail: sources owned by several teams -> "nobody" (no team sees it). */
async function recordFinding(payload: unknown, { writer, now, runId }: ActionCtx) {
  const p = RecordFinding.parse(payload);
  const g = writer();
  const { loadIndex } = await import("../permissions/redact");
  const idx = await loadIndex(g);
  const owners = [...new Set([...p.sources.map((s) => idx.artifacts.get(s)), ...p.entityIds.map((e) => idx.ids.get(e)?.owner)].filter((o): o is string => !!o))];
  const restrictedTo = owners.length > 1 ? "nobody" : (owners[0] ?? null);
  const agent = runId ? await agentOf(runId) : "unknown";
  const [row] = await query<{ n: number }>(g, load("finding-record").text, { ...p, now, agent, runId: runId ?? null, restrictedTo });
  if (!row?.n) throw new Error("none of the entities exist in the graph");
  await query(g, load("finding-supersede").text, { id: p.id, agent, entityIds: p.entityIds, now });
  return { findingId: p.id, about: row.n, restrictedTo };
}

export const SendReminder = z.object({ decisionId: z.string().min(1), teamId: z.string().min(1), title: z.string().optional() });

export const EXECUTORS: Partial<Record<ActionKind, (payload: unknown, ctx: ActionCtx) => Promise<unknown>>> = {
  create_task: async (payload, { writer, now }) =>
    query(writer(), load("create-tasks").text, { rows: [CreateTask.parse(payload)], now }),
  draft_doc: async (payload, ctx) => saveDraft(payload, ctx),
  // Approved chase: one campaign.chase event; the notification engine routes it to the team owner (CC the change owner) and delivers it.
  send_reminder: async (payload, { org, approver, now }) => {
    const p = SendReminder.parse(payload);
    const [{ db }, { emit }] = await Promise.all([import("../db"), import("../events/emit")]);
    const r = await emit(db(), {
      type: "campaign.chase", orgId: org.id, subject: { kind: "change", id: p.decisionId },
      payload: { changeId: p.decisionId, teamId: p.teamId, by: approver ?? "unknown" },
      dedupeKey: `campaign.chase:${org.id}:${p.decisionId}:${p.teamId}:${now}`,
    });
    return { emitted: r.inserted, changeId: p.decisionId, teamId: p.teamId };
  },
  access_request: async (payload, ctx) => openAccessRequest(payload, ctx),
  record_finding: async (payload, ctx) => recordFinding(payload, ctx),
  create_issue: async (payload, { org }) => {
    const { title, body } = CreateIssue.parse(payload);
    const ge = await githubEnv();
    const r = await createIssue({ ...ge, GITHUB_APP_INSTALLATION_ID: ge.GITHUB_APP_INSTALLATION_ID ?? (await orgInstallation(org.id)) }, title, body);
    if (r.status === "failed") throw new Error(r.error ?? "create issue failed");
    return r;
  },
  pr_comment: async (payload, { org }) => {
    const p = PrComment.parse(payload);
    return prComment(await githubEnv(), await orgInstallation(org.id), p);
  },
  graph_merge: async (payload, { org, writer, now }) => {
    if (payload && typeof payload === "object" && "op" in payload) {
      if (payload.op !== "suggest_merge") {
        const r = await applyProposal(writer(), payload, now, org.id); // a connector or ingest proposal
        if (r.applied) return r;
        // Fail loudly (the action is marked failed and can be approved again); point at the node proposal from the same source if there is one.
        const { db } = await import("../db");
        const { pendingActions } = await import("../db/schema");
        const { and, eq, sql } = await import("drizzle-orm");
        const src = (payload as { src?: string }).src;
        const [node] = await db().select({ id: pendingActions.id }).from(pendingActions).where(and(
          eq(pendingActions.orgId, org.id), eq(pendingActions.kind, "graph_merge"), eq(pendingActions.status, "pending"),
          sql`${pendingActions.payload}->>'op' = 'merge_node'`, sql`${pendingActions.payload}->>'id' = ${r.missing.id}`, sql`${pendingActions.payload}->>'src' = ${src ?? ""}`,
        )).limit(1);
        throw new Error(`Approve the new node ${r.missing.label} ${r.missing.id} first${node ? ` (action ${node.id})` : ""}`);
      }
      // "These two names are the same node": approving records the alias so later ingests resolve it exactly. Never rewrites the graph.
      const p = SuggestMerge.parse(payload);
      const { db } = await import("../db"); // lazy: keeps lib/db (server-only) out of the pure-executor import graph
      const { entityAliases } = await import("../db/schema");
      await db().insert(entityAliases).values({ orgId: org.id, kind: p.kind, aliasNorm: p.aliasNorm, nodeId: p.nodeId }).onConflictDoNothing();
      return { aliased: p.aliasNorm, nodeId: p.nodeId };
    }
    const { label, id, props } = GraphMerge.parse(payload);
    return query(writer(), `MERGE (n:${label} {id: $id}) SET n += $props, n.updatedAt = $now RETURN n.id AS id`, { id, props, now });
  },
};

/** Who may approve each kind besides an admin. */
export const OWNER_ROLE: Record<ActionKind, "lead" | "change_owner"> = {
  create_task: "lead", create_issue: "lead", graph_merge: "change_owner", send_slack: "lead", send_email: "lead", pr_comment: "lead", access_request: "lead", draft_doc: "lead", send_reminder: "lead", record_finding: "lead",
};
