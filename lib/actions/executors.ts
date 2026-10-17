// Action executors: the only code that performs a side effect on behalf of an agent. kind -> (payload, ctx) => result.
// Later connector issues add send_slack, send_email, pr_comment, ...
import { createSign } from "node:crypto";
import { z } from "zod";
import { env, type Env } from "../env";
import { query, type Graph } from "../graph/client";
import { load } from "../graph/queries";
import type { ActionKind } from "../agent/define";
import { applyProposal } from "../connectors/apply";

export type ActionCtx = { org: { id: string }; now: number; writer: () => Graph };

export const CreateTask = z.object({ id: z.string().min(1), teamId: z.string().min(1), decisionId: z.string().min(1), title: z.string().min(1), body: z.string() });
// Labels are interpolated into Cypher, so they come from this list only.
export const GraphMerge = z.object({
  label: z.enum(["Task", "Person", "Team", "System"]),
  id: z.string().min(1),
  props: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).refine((p) => !("id" in p), "props.id is not allowed").default({}),
});

export const SuggestMerge = z.object({
  op: z.literal("suggest_merge"), kind: z.enum(["Person", "Team", "System", "Customer"]), aliasNorm: z.string().min(1), nodeId: z.string().min(1),
  mention: z.string(), score: z.number(), newId: z.string(), src: z.string().optional(), quote: z.string().optional(),
});

export type GithubEnv = Partial<Pick<Env, "GITHUB_APP_ID" | "GITHUB_APP_INSTALLATION_ID" | "GITHUB_APP_PRIVATE_KEY" | "GITHUB_REPO">>;
export const CreateIssue = z.object({ title: z.string().min(1), body: z.string() });

/** GitHub App: RS256 JWT -> installation token -> create issue in GITHUB_REPO (owner/name). The only GitHub caller. */
export async function createIssue(e: GithubEnv, title: string, body: string): Promise<{ status: "created" | "skipped" | "failed"; url?: string; error?: string }> {
  const { GITHUB_APP_ID: app, GITHUB_APP_INSTALLATION_ID: inst, GITHUB_APP_PRIVATE_KEY: pem, GITHUB_REPO: repo } = e;
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
  } catch (err) {
    return { status: "failed", error: String(err) };
  }
}

export const EXECUTORS: Partial<Record<ActionKind, (payload: unknown, ctx: ActionCtx) => Promise<unknown>>> = {
  create_task: async (payload, { writer, now }) =>
    query(writer(), load("create-tasks").text, { rows: [CreateTask.parse(payload)], now }),
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
