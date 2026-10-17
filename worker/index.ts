// Worker process: `pnpm worker`. Owns pg-boss start (migrations, maintenance) and runs the handlers.
import { PgBoss, type Job } from "pg-boss";
import { POLICY, QUEUES, bossOptions } from "../lib/queue";
<<<<<<< HEAD
import { safeMessage } from "../lib/log";
=======
import agent from "./handlers/agent";
>>>>>>> 8672ae5 (feat: background agent runtime with run log and budgets (#131))
import noop from "./handlers/noop";
import routeEvent from "./handlers/route-event";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Handlers = Record<string, (jobs: Job<any>[]) => Promise<unknown>>;
export const handlers: Handlers = { noop, "route-event": routeEvent, agent };

/** Start a worker against `url`; returns the graceful stop function. */
export async function startWorker(url: string, use: Handlers = handlers) {
  const boss = new PgBoss(bossOptions(url));
  boss.on("error", (e) => console.error("[worker]", safeMessage(e)));
  await boss.start();
  for (const q of QUEUES) await boss.createQueue(q, { policy: POLICY[q] ?? "standard" }); // idempotent
  for (const [name, fn] of Object.entries(use)) await boss.work(name, fn);
  return () => boss.stop({ graceful: true, timeout: 10_000 });
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) { console.error("[worker] DATABASE_URL is not set; nothing to do. Exiting."); process.exit(1); }
  const stop = await startWorker(url);
  console.log("[worker] ready");
  process.once("SIGTERM", () => stop().then(() => { console.log("[worker] stopped"); process.exit(0); }));
  process.once("SIGINT", () => process.kill(process.pid, "SIGTERM"));
}
if (process.argv[1]?.endsWith("worker/index.ts")) void main();
