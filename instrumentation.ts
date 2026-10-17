import { env } from "./lib/env";

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  env(); // validate once at boot: logs bad vars (warn mode) or throws (ENV_STRICT=1)
  try {
    const { seedIfEmpty } = await import("./lib/graph/bootstrap");
    const { migrateGraph } = await import("./lib/graph/migrate");
    const { graphFor } = await import("./lib/graph/client");
    const { getContext } = await import("./lib/server/context");
    const graphName = (await getContext()).org.graphName;
    console.log(`[ripple] demo graph: ${await seedIfEmpty(graphName)}`);
    console.log(`[ripple] migrations applied: ${(await migrateGraph(await graphFor(graphName))).join(", ") || "none"}`);
  } catch (e) {
    // never crash the server because FalkorDB is down; /api/health reports it
    console.error("[ripple] startup seed skipped:", e instanceof Error ? e.message : e);
  }
}
