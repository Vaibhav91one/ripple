import { closeClient } from "../lib/graph/client";
import { seed } from "../lib/ingest/seed";

// The suite runs against its own graph (E2E_GRAPH, passed to the server as RIPPLE_GRAPH), so it never reads or
// rewrites the shared demo graph. A half-seeded demo graph would otherwise 404 on /changes/d-1 and /graph.
export const E2E_GRAPH = "e2e_smoke";

export default async function globalSetup() {
  if (process.env.E2E_BASE_URL) return; // a deployed app uses its own graph
  await seed(E2E_GRAPH);
  await closeClient();
}
