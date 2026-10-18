import { and, eq } from "drizzle-orm";
import { env } from "@/lib/env";
import { githubEnv } from "@/lib/connectors/github/app-creds";
import { MENTION_EVENTS, parseMention, type GithubJob } from "@/lib/connectors/github/mention";
import { SLUG_DEFAULT } from "@/lib/connectors/github/manifest";
import { handleWebhook } from "@/lib/connectors/webhook";
import { github } from "@/lib/connectors/github";
import { verifySignature } from "@/lib/connectors/github/client";
import { enqueue } from "@/lib/queue";

// The GitHub App has ONE webhook URL for every installation, so unlike /api/connectors/<kind>/webhook?account=... this route
// verifies the signature first (401 when bad), then finds the account from payload.installation.id.
const RESYNC = new Set(["push", "installation", "installation_repositories"]);

type Pr = { action?: string; number?: number; pull_request?: { head?: { sha?: string }; html_url?: string }; repository?: { full_name: string }; installation?: { id: number } };

/** True once per delivery: the event log's unique dedupe_key, so a redelivery never answers twice. */
async function firstDelivery(orgId: string, key: string, type: string, subject: string): Promise<boolean> {
  const [{ db }, { events }] = await Promise.all([import("@/lib/db"), import("@/lib/db/schema")]);
  const rows = await db().insert(events).values({ orgId, type, subjectKind: "github", subjectId: subject, payload: {}, dedupeKey: key }).onConflictDoNothing({ target: events.dedupeKey }).returning({ id: events.id });
  return rows.length > 0;
}

export async function POST(req: Request) {
  const ge = await githubEnv();
  const secret = ge.GITHUB_APP_WEBHOOK_SECRET;
  if (!secret) return Response.json({ error: "webhook_secret_not_configured" }, { status: 503 });
  const raw = await req.text();
  if (!(await verifySignature(secret, raw, req.headers.get("x-hub-signature-256")))) return Response.json({ error: "bad_signature" }, { status: 401 });
  if (!env().DATABASE_URL) return Response.json({ error: "db_not_configured" }, { status: 503 });

  const installation = (JSON.parse(raw) as { installation?: { id?: number } }).installation?.id;
  if (!installation) return Response.json({ ok: true, ignored: true });
  const [{ db }, { connectorAccounts }] = await Promise.all([import("@/lib/db"), import("@/lib/db/schema")]);
  const [acct] = await db().select({ id: connectorAccounts.id, orgId: connectorAccounts.orgId }).from(connectorAccounts)
    .where(and(eq(connectorAccounts.kind, "github"), eq(connectorAccounts.externalId, String(installation)))); // ponytail: one org per installation; the unique key is (org, kind, external id)
  if (!acct) return Response.json({ ok: true, ignored: true }); // installed on GitHub but never connected here
  const event = req.headers.get("x-github-event") ?? "";
  const delivery = req.headers.get("x-github-delivery") ?? "";
  const payload = JSON.parse(raw) as Pr;
  if (MENTION_EVENTS.includes(event)) { // @mention or /ripple on an issue, a PR conversation or a review thread: ack now, answer in the worker
    const m = parseMention(event, payload as never, ge.GITHUB_APP_SLUG ?? SLUG_DEFAULT);
    if (!m) return Response.json({ ok: true, ignored: true });
    if (!(await firstDelivery(acct.orgId, `github:mention:${delivery}`, "github.mention", `gh:${m.repo}#${m.number}`))) return Response.json({ ok: true, duplicate: true });
    await enqueue("github-reply", m satisfies GithubJob);
    return Response.json({ ok: true, queued: "mention" });
  }
  if (event === "pull_request" && ["opened", "synchronize", "reopened"].includes(payload.action ?? "") && payload.pull_request?.head?.sha && payload.repository) {
    if (await firstDelivery(acct.orgId, `github:check:${delivery}`, "github.check", `gh:${payload.repository.full_name}#${payload.number}`))
      await enqueue("github-reply", { kind: "check", installation, repo: payload.repository.full_name, number: payload.number!, headSha: payload.pull_request.head.sha, url: payload.pull_request.html_url ?? "" } satisfies GithubJob);
  }
  if (RESYNC.has(event)) {
    await enqueue("sync", { accountId: acct.id }, { singletonKey: `sync:${acct.id}` });
    return Response.json({ ok: true, resync: true });
  }
  return handleWebhook(github, acct.id, new Request(req.url, { method: "POST", headers: req.headers, body: raw }));
}
