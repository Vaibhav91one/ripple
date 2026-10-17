import { and, eq } from "drizzle-orm";
import { env } from "@/lib/env";
import { handleWebhook } from "@/lib/connectors/webhook";
import { github } from "@/lib/connectors/github";
import { verifySignature } from "@/lib/connectors/github/client";
import { enqueue } from "@/lib/queue";

// The GitHub App has ONE webhook URL for every installation, so unlike /api/connectors/<kind>/webhook?account=... this route
// verifies the signature first (401 when bad), then finds the account from payload.installation.id.
const RESYNC = new Set(["push", "installation", "installation_repositories"]);

export async function POST(req: Request) {
  const secret = env().GITHUB_APP_WEBHOOK_SECRET;
  if (!secret) return Response.json({ error: "webhook_secret_not_configured" }, { status: 503 });
  const raw = await req.text();
  if (!(await verifySignature(secret, raw, req.headers.get("x-hub-signature-256")))) return Response.json({ error: "bad_signature" }, { status: 401 });
  if (!env().DATABASE_URL) return Response.json({ error: "db_not_configured" }, { status: 503 });

  const installation = (JSON.parse(raw) as { installation?: { id?: number } }).installation?.id;
  if (!installation) return Response.json({ ok: true, ignored: true });
  const [{ db }, { connectorAccounts }] = await Promise.all([import("@/lib/db"), import("@/lib/db/schema")]);
  const [acct] = await db().select({ id: connectorAccounts.id }).from(connectorAccounts)
    .where(and(eq(connectorAccounts.kind, "github"), eq(connectorAccounts.externalId, String(installation)))); // ponytail: one org per installation; the unique key is (org, kind, external id)
  if (!acct) return Response.json({ ok: true, ignored: true }); // installed on GitHub but never connected here
  if (RESYNC.has(req.headers.get("x-github-event") ?? "")) {
    await enqueue("sync", { accountId: acct.id }, { singletonKey: `sync:${acct.id}` });
    return Response.json({ ok: true, resync: true });
  }
  return handleWebhook(github, acct.id, new Request(req.url, { method: "POST", headers: req.headers, body: raw }));
}
