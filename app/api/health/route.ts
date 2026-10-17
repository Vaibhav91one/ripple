import { connection } from "next/server";
import { healDemo, nodeCount } from "@/lib/graph/bootstrap";
import { getContext } from "@/lib/server/context";

const PROBE_MS = 2500; // the whole probe, connect included, so health answers inside ~3s even when FalkorDB hangs

export async function GET(_req?: Request) {
  await connection();
  const llm = process.env.LLM_API_KEY ? "configured" : "fallback";
  let timer: NodeJS.Timeout | undefined;
  try {
    const probe = (async () => {
      const { org } = await getContext(_req);
      const n = await nodeCount(org.graphName, { timeoutMs: PROBE_MS });
      if (n === 0 && org.isDemo) healDemo(org.graphName);
      return n;
    })();
    probe.catch(() => {}); // a probe that loses the race must not become an unhandled rejection
    const timedOut = new Promise<never>((_, rej) => { timer = setTimeout(() => rej(new Error("probe timeout")), PROBE_MS); });
    return Response.json({ ok: true, falkordb: "up", graph: await Promise.race([probe, timedOut]), llm });
  } catch {
    return Response.json({ ok: false, falkordb: "down", graph: 0, llm }, { status: 503 });
  } finally {
    clearTimeout(timer);
  }
}
