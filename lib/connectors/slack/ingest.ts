// Shared by /api/slack/{events,interactive,command}: verify, ack fast (200), enqueue the work.
// Dedupe: the queue job's singletonKey carries Slack's event_id / trigger_id, so a retry (X-Slack-Retry-Num) is a no-op.
import { env } from "../../env";
import { emit } from "../../events/emit";
import { enqueue } from "../../queue";
import { verifySlack } from "./verify";
import type { SlackAccountRef } from "./store";

export type SlackKind = "events" | "interactive" | "command";
type Deps = { accounts: (teamId: string) => Promise<SlackAccountRef[]>; enqueue: typeof enqueue; emit: typeof emit; hasDb: boolean; secret?: string };

/** Dedupe is durable: the delivery is inserted in the event log first (unique dedupe_key) and only a new row is enqueued. No DB = queue-only dedupe. */
export async function ingest(req: Request, kind: SlackKind, deps?: Partial<Deps>): Promise<Response> {
  const raw = await req.text(); // raw body: the signature covers the exact bytes
  if (!verifySlack(raw, req.headers, deps?.secret ?? env().SLACK_SIGNING_SECRET)) return Response.json({ error: "bad_signature" }, { status: 401 });

  let teamId: string | undefined;
  let key: string | undefined;
  let data: unknown;
  try {
    if (kind === "events") {
      const b = JSON.parse(raw);
      if (b.type === "url_verification") return Response.json({ challenge: b.challenge });
      if (b.type !== "event_callback") return Response.json({ ok: true, ignored: true });
      [teamId, key, data] = [b.team_id, b.event_id, b.event];
    } else {
      const form = new URLSearchParams(raw);
      if (kind === "interactive") {
        const p = JSON.parse(form.get("payload") ?? "");
        [teamId, key, data] = [p.team?.id, p.trigger_id ?? p.action_ts, p];
      } else {
        [teamId, key, data] = [form.get("team_id") ?? undefined, form.get("trigger_id") ?? undefined, Object.fromEntries(form)];
      }
    }
  } catch {
    return Response.json({ error: "bad_body" }, { status: 400 });
  }
  if (typeof teamId !== "string" || typeof key !== "string") return Response.json({ error: "bad_body" }, { status: 400 });

  const hasDb = deps?.hasDb ?? !!env().DATABASE_URL;
  if (!deps?.accounts && !hasDb) return Response.json({ error: "db_not_configured" }, { status: 503 });
  const accounts = await (deps?.accounts ?? (await import("./store")).accountsForTeam)(teamId);
  const q = deps?.enqueue ?? enqueue;
  const em = deps?.emit ?? emit;
  for (const a of accounts) {
    const job = { kind, accountId: a.id, orgId: a.orgId, teamId, data };
    const opts = { singletonKey: `slack:${kind}:${a.id}:${key}` };
    if (!hasDb) { await q("slack-inbound", job, opts); continue; }
    const { db } = await import("../../db");
    const r = await em(db(), { type: "slack.inbound", orgId: a.orgId, subject: { kind: "slack", id: key }, payload: { kind: kind === "events" ? "event" : kind, teamId, body: data }, dedupeKey: `slack:${key}:${a.orgId}` });
    if (r.inserted) await q("slack-inbound", job, opts);
  }
  return new Response(null, { status: 200 }); // empty 200 is what slash commands and interactivity want
}
