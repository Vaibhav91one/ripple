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
  graph_merge: async (payload, { writer, now }) => {
    if (payload && typeof payload === "object" && "op" in payload) return applyProposal(writer(), payload, now); // a connector proposal
    const { label, id, props } = GraphMerge.parse(payload);
    return query(writer(), `MERGE (n:${label} {id: $id}) SET n += $props, n.updatedAt = $now RETURN n.id AS id`, { id, props, now });
  },
};

/** Who may approve each kind besides an admin. */
export const OWNER_ROLE: Record<ActionKind, "lead" | "change_owner"> = {
  create_task: "lead", create_issue: "lead", graph_merge: "change_owner", send_slack: "lead", send_email: "lead", pr_comment: "lead", access_request: "lead", draft_doc: "lead",
};
