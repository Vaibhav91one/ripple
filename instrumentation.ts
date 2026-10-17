import { env } from "./lib/env";

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  env(); // validate once at boot: logs bad vars (warn mode) or throws (ENV_STRICT=1)
  try {
    const { seedIfEmpty } = await import("./lib/graph/bootstrap");
    const { getContext } = await import("./lib/server/context");
    console.log(`[ripple] demo graph: ${await seedIfEmpty((await getContext()).org.graphName)}`);
  } catch (e) {
    // never crash the server because FalkorDB is down; /api/health reports it
    console.error("[ripple] startup seed skipped:", e instanceof Error ? e.message : e);
  }
}
