import { env } from "./lib/env";

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  env(); // validate once at boot: logs bad vars (warn mode) or throws (ENV_STRICT=1)
  try {
    const { seedIfEmpty } = await import("./lib/graph/bootstrap");
    console.log(`[ripple] demo graph: ${await seedIfEmpty()}`);
  } catch (e) {
    // never crash the server because FalkorDB is down; /api/health reports it
    console.error("[ripple] startup seed skipped:", e instanceof Error ? e.message : e);
  }
}
