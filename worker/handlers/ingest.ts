import type { Job } from "pg-boss";

/** Chunks, extracts, resolves and proposes for one stored document. Re-running is safe: proposals dedupe on their payload. */
export default async function ingestJob(jobs: Job<{ documentId: string }>[]) {
  const { processDocument } = await import("../../lib/ingest/pipeline"); // lazy: lib/db is "server-only"
  for (const j of jobs) console.log("[worker] ingest", j.data.documentId, await processDocument(j.data.documentId));
}
