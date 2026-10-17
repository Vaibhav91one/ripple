// Seed the demo graph when empty. Idempotent; used by instrumentation.ts and /api/reset.
import { graphFor, guard, roQuery, type QueryOpts } from "./client";
import { seed } from "../ingest/seed";
import { migrateGraph } from "./migrate";

export async function nodeCount(graphName: string, opts: QueryOpts = {}): Promise<number> {
  const rows = await roQuery<{ n: number }>(await graphFor(graphName), "MATCH (n) WHERE NOT n:Migration RETURN count(n) AS n", {}, opts);
  return Number(rows[0]?.n ?? 0);
}

export async function seedIfEmpty(graphName: string): Promise<"seeded" | "present"> {
  if ((await nodeCount(graphName)) > 0) return "present";
  await seed(graphName);
  await migrateGraph(await graphFor(graphName));
  return "seeded";
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
  return seedIfEmpty(graphName).then(
    (r) => { if (r === "seeded") console.warn(`graph ${graphName} was empty, re-seeded`); },
    (e) => console.error("demo heal failed:", e instanceof Error ? e.message : e),
  );
}
