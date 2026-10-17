// Action executors: the only code that performs a side effect on behalf of an agent. kind -> (payload, ctx) => result.
// Later connector issues add send_slack, send_email, pr_comment, ...
import { z } from "zod";
import { env, type Env } from "../env";
import { query, type Graph } from "../graph/client";
import { load } from "../graph/queries";
import type { ActionKind } from "../agent/define";
import { applyProposal } from "../connectors/apply";
import { githubApp } from "../connectors/github/client";
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

// notice/amendment answer a contract (Legal); email/talk_track answer a customer (Sales and CS, Customer Exposure).
export const DraftDoc = z.object({
  kind: z.enum(["notice", "amendment", "email", "talk_track"]), contractId: z.string().min(1).optional(), customerId: z.string().min(1).optional(),
  decisionId: z.string().min(1), title: z.string().min(1), body: z.string().min(1),
}).refine((d) => (d.kind === "email" || d.kind === "talk_track" ? !!d.customerId : !!d.contractId), "a contract draft needs contractId, a customer draft needs customerId");

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

/** Approved draft -> `document` row (deduped by content per org) + a Doc:Artifact node ABOUT the contract and the decision. Legal-only on read (restrictedTo). Returns the document id. */
async function saveDraft(payload: unknown, { org, writer, now, approver, runId }: ActionCtx) {
  const p = DraftDoc.parse(payload);
  const { db } = await import("../db"); // lazy: keeps lib/db (server-only) out of the pure-executor import graph
  const { documents, agentRuns } = await import("../db/schema");
  const { and, eq } = await import("drizzle-orm");
  const { createHash } = await import("node:crypto");
  const sha256 = createHash("sha256").update(p.body).digest("hex");
  const run = runId ? (await db().select({ agent: agentRuns.agent }).from(agentRuns).where(eq(agentRuns.id, runId)))[0] : undefined;
  const [ins] = await db().insert(documents).values({ orgId: org.id, sourceKind: "doc", sourceRef: `draft:${p.kind}:${p.contractId ?? p.customerId}`, title: p.title, text: p.body, sha256 })
    .onConflictDoNothing({ target: [documents.orgId, documents.sha256] }).returning({ id: documents.id });
  const id = ins?.id ?? (await db().select({ id: documents.id }).from(documents).where(and(eq(documents.orgId, org.id), eq(documents.sha256, sha256))))[0].id;
  await query(writer(), `MERGE (a:Doc:Artifact {id: $id})
    SET a.kind = 'doc', a.title = $title, a.text = $text, a.ts = $now, a.uri = '', a.author = $author, a.approvedBy = $approvedBy, a.draftKind = $draftKind, a.restrictedTo = $owner
    WITH a
    OPTIONAL MATCH (c:Contract {id: $contractId})
    OPTIONAL MATCH (cu:Customer {id: $customerId})
    OPTIONAL MATCH (d:Decision {id: $decisionId})
    FOREACH (_ IN CASE WHEN cu IS NULL THEN [] ELSE [1] END | MERGE (a)-[r:ABOUT]->(cu) SET r.valid_from = $now, r.valid_to = null, r.observed_at = $now)
    FOREACH (_ IN CASE WHEN c IS NULL THEN [] ELSE [1] END | MERGE (a)-[r:ABOUT]->(c) SET r.valid_from = $now, r.valid_to = null, r.observed_at = $now)
    FOREACH (_ IN CASE WHEN d IS NULL THEN [] ELSE [1] END | MERGE (a)-[r:ABOUT]->(d) SET r.valid_from = $now, r.valid_to = null, r.observed_at = $now)`,
  { id, title: p.title, text: p.body, now, author: `agent:${run?.agent ?? "unknown"}`, approvedBy: approver ?? "unknown", draftKind: p.kind, contractId: p.contractId ?? null, customerId: p.customerId ?? null, decisionId: p.decisionId, owner: p.customerId ? "sales" : "legal" });
  return { documentId: id, kind: p.kind, contractId: p.contractId ?? null, customerId: p.customerId ?? null, decisionId: p.decisionId };
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

export const EXECUTORS: Partial<Record<ActionKind, (payload: unknown, ctx: ActionCtx) => Promise<unknown>>> = {
  create_task: async (payload, { writer, now }) =>
    query(writer(), load("create-tasks").text, { rows: [CreateTask.parse(payload)], now }),
  draft_doc: async (payload, ctx) => saveDraft(payload, ctx),
  access_request: async (payload, ctx) => openAccessRequest(payload, ctx),
  create_issue: async (payload) => {
    const { title, body } = CreateIssue.parse(payload);
    const r = await createIssue(env(), title, body);
    if (r.status === "failed") throw new Error(r.error ?? "create issue failed");
    return r;
  },
  graph_merge: async (payload, { org, writer, now }) => {
    if (payload && typeof payload === "object" && "op" in payload) {
      if (payload.op !== "suggest_merge") {
        const r = await applyProposal(writer(), payload, now); // a connector or ingest proposal
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
  create_task: "lead", create_issue: "lead", graph_merge: "change_owner", send_slack: "lead", send_email: "lead", pr_comment: "lead", access_request: "lead", draft_doc: "lead",
};
