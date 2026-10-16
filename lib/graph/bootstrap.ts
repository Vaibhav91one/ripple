// Seed the demo graph when empty. Idempotent; used by instrumentation.ts and /api/reset.
import { graphFor, query } from "./client";
import { seed } from "../ingest/seed";

export const DEMO = "demo";

export async function nodeCount(): Promise<number> {
  const rows = await query<{ n: number }>(await graphFor(DEMO), "MATCH (n) RETURN count(n) AS n");
  return Number(rows[0]?.n ?? 0);
}

export async function seedIfEmpty(): Promise<"seeded" | "present"> {
  if ((await nodeCount()) > 0) return "present";
  await seed(DEMO);
  return "seeded";
}

export async function resetDemo(): Promise<void> {
  try {
    await (await graphFor(DEMO)).delete();
  } catch {
    // graph did not exist yet
  }
  await seed(DEMO);
}
