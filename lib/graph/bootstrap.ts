// Seed the demo graph when empty. Idempotent; used by instrumentation.ts and /api/reset.
import { client, graphFor, guard, roQuery, type QueryOpts } from "./client";
import { SEED_VERSION, seed } from "../ingest/seed";
import { migrateGraph } from "./migrate";

export async function nodeCount(graphName: string, opts: QueryOpts = {}): Promise<number> {
  const rows = await roQuery<{ n: number }>(await graphFor(graphName), "MATCH (n) WHERE NOT n:Migration AND NOT n:SeedInfo RETURN count(n) AS n", {}, opts);
  return Number(rows[0]?.n ?? 0);
}

export async function seedIfEmpty(graphName: string): Promise<"seeded" | "present"> {
  if ((await nodeCount(graphName)) > 0) return "present";
  await seed(graphName);
  await migrateGraph(await graphFor(graphName));
  return "seeded";
}

async function seedVersionOf(graphName: string): Promise<string | undefined> {
  const rows = await roQuery<{ v: string }>(await graphFor(graphName), "MATCH (s:SeedInfo) RETURN s.version AS v");
  return rows[0]?.v;
}

const rebuilds = new Map<string, Promise<unknown>>();

/**
 * Seed `graphName` when empty; when it holds an older seed (no SeedInfo, or another version), rebuild it in
 * `<name>_next` and swap it in with an atomic RENAME, so readers see the old graph until the new one is complete.
 * Demo graph only: never call it for an org graph.
 */
export async function syncSeed(graphName: string): Promise<"seeded" | "present" | `reseeded: ${string} -> ${string}`> {
  if ((await nodeCount(graphName)) === 0) return seedIfEmpty(graphName);
  const old = await seedVersionOf(graphName);
  if (old === SEED_VERSION) return "present";
  const next = `${graphName}_next`;
  // ponytail: in-process dedupe only; two instances booting at once would race on <name>_next
  const running = rebuilds.get(graphName);
  if (running) await running;
  else {
    const job = (async () => {
      await guard(async () => (await graphFor(next)).delete()).catch(() => {}); // leftover from a failed run
      await seed(next);
      await migrateGraph(await graphFor(next));
      await guard(async () => (await (await client()).connection).rename(next, graphName)); // overwrites the target atomically
    })().finally(() => rebuilds.delete(graphName));
    rebuilds.set(graphName, job);
    await job;
  }
  const msg = `${old ?? "none"} -> ${SEED_VERSION}` as const;
  console.log(`[ripple] demo graph reseeded: ${msg}`);
  return `reseeded: ${msg}`;
}

export async function resetDemo(graphName: string): Promise<void> {
  try {
    const g = await graphFor(graphName);
    await guard(() => g.delete());
  } catch {
    // graph did not exist yet
  }
  await seed(graphName);
}

const lastHeal = new Map<string, number>();
const HEAL_EVERY_MS = 60_000;

/**
 * Self-heal after FalkorDB data loss: re-seed `graphName` if it reads empty. Call it for the demo graph only.
 * Fire and forget (never blocks a request), at most once a minute per graph, errors logged once per attempt.
 * Returns the in-flight heal (undefined when throttled) so tests can await it instead of sleeping.
 */
export function healDemo(graphName: string, now = Date.now()): Promise<void> | undefined {
  if (now - (lastHeal.get(graphName) ?? -Infinity) < HEAL_EVERY_MS) return;
  lastHeal.set(graphName, now);
  return syncSeed(graphName).then(
    (r) => { if (r === "seeded") console.warn(`graph ${graphName} was empty, re-seeded`); },
    (e) => console.error("demo heal failed:", e instanceof Error ? e.message : e),
  );
}
