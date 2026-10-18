// pg-boss queue on the direct Postgres connection (needs LISTEN/NOTIFY + advisory locks: no pgbouncer).
// The web side only sends; the worker process (worker/index.ts) starts, migrates and creates queues.
import { PgBoss, type SendOptions } from "pg-boss";
import { safeMessage } from "./log";
import { env } from "./env";

export const QUEUES = ["route-event", "agent", "agent-cron", "deliver", "sync", "slack-inbound", "github-reply", "reminder", "digest", "execute-action", "ingest", "noop"] as const;
export type QueueName = (typeof QUEUES)[number];

/** singletonKey only dedupes on a non-standard policy. `short` = one queued job per key; route-event and deliver are always keyed. */
export const POLICY: Partial<Record<QueueName, "short">> = { "route-event": "short", deliver: "short", reminder: "short", sync: "short", "slack-inbound": "short", "github-reply": "short" };

// PGBOSS_SCHEMA: tests set a unique schema so suites sharing one Postgres never steal each other's jobs. Unset = pg-boss default.
export const bossOptions = (connectionString: string) => ({ connectionString, max: 3, ...(process.env.PGBOSS_SCHEMA && { schema: process.env.PGBOSS_SCHEMA }) });

let boss: Promise<PgBoss> | undefined;

/** Lazy sender. start() only opens the pool: supervise/schedule/migrate are off, so no maintenance, migrations or polling on the web side. */
export function queue(): Promise<PgBoss> | undefined {
  const url = env().DATABASE_URL;
  if (!url) return undefined;
  boss ??= (async () => {
    const b = new PgBoss({ ...bossOptions(url), supervise: false, schedule: false, migrate: false });
    b.on("error", (e) => console.error("[queue]", safeMessage(e)));
    return b.start();
  })();
  return boss;
}

/** Safe to call anywhere: no DATABASE_URL = logged no-op; a failed send is logged, never thrown. Returns the job id, or null (deduped / skipped). */
export async function enqueue(
  name: QueueName, data: object, opts: Pick<SendOptions, "singletonKey" | "startAfter"> = {},
): Promise<string | null> {
  const q = queue();
  if (!q) { console.warn(`[queue] DATABASE_URL unset, dropping ${name} job`); return null; }
  try {
    return await (await q).send(name, data, opts);
  } catch (e) {
    console.error(`[queue] enqueue ${name} failed:`, safeMessage(e));
    return null;
  }
}
