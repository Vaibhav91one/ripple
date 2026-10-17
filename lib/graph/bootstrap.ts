// Seed the demo graph when empty. Idempotent; used by instrumentation.ts and /api/reset.
import { graphFor, roQuery } from "./client";
import { seed } from "../ingest/seed";

export async function nodeCount(graphName: string): Promise<number> {
  const rows = await roQuery<{ n: number }>(await graphFor(graphName), "MATCH (n) RETURN count(n) AS n");
  return Number(rows[0]?.n ?? 0);
}

export async function seedIfEmpty(graphName: string): Promise<"seeded" | "present"> {
  if ((await nodeCount(graphName)) > 0) return "present";
  await seed(graphName);
  return "seeded";
}

export async function resetDemo(graphName: string): Promise<void> {
  try {
    await (await graphFor(graphName)).delete();
  } catch {
    // graph did not exist yet
  }
  await seed(graphName);
}
