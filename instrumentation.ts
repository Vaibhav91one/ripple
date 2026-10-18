import { env } from "./lib/env";

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  env(); // validate once at boot: logs bad vars (warn mode) or throws (ENV_STRICT=1)
  try {
    const { seedIfEmpty, syncSeed } = await import("./lib/graph/bootstrap");
    const { migrateGraph } = await import("./lib/graph/migrate");
    const { graphFor } = await import("./lib/graph/client");
    const { getContext } = await import("./lib/server/context");
    const { org } = await getContext();
    const graphName = org.graphName;
    // only the shared demo is rebuilt on a seed-version change; a custom RIPPLE_GRAPH is only seeded when empty
    // an org graph (t_<orgId>) never gets demo data at boot: an empty org sees onboarding and may load the sample itself (#274)
    if (graphName.startsWith("t_")) console.log(`[ripple] org graph ${graphName}: not seeded`);
    else console.log(`[ripple] demo graph: ${await (org.isDemo && !process.env.RIPPLE_GRAPH ? syncSeed : seedIfEmpty)(graphName)}`);
    console.log(`[ripple] migrations applied: ${(await migrateGraph(await graphFor(graphName))).join(", ") || "none"}`);
  } catch (e) {
    // never crash the server because FalkorDB is down; /api/health reports it
    console.error("[ripple] startup seed skipped:", e instanceof Error ? e.message : e);
  }
}
