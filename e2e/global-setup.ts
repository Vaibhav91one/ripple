import { closeClient, graphFor } from "../lib/graph/client";
import { seed } from "../lib/ingest/seed";

// The suite runs against its own graph (E2E_GRAPH, passed to the server as RIPPLE_GRAPH), so it never reads or
// rewrites the shared demo graph. A half-seeded demo graph would otherwise 404 on /changes/d-1 and /graph.
export const E2E_GRAPH = "e2e_smoke";
/** A local-mode org with nothing in it (#274): the second server's RIPPLE_GRAPH, emptied before every run. */
export const E2E_EMPTY_GRAPH = "t_e2e_empty_274";
export const E2E_EMPTY_PORT = 3274;

export default async function globalSetup() {
  if (process.env.E2E_BASE_URL) return; // a deployed app uses its own graph
  await seed(E2E_GRAPH);
  await (await graphFor(E2E_EMPTY_GRAPH)).delete().catch(() => {}); // absent on a first run
  await closeClient();
}
