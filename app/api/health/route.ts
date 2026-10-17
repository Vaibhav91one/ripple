import { connection } from "next/server";
import { nodeCount } from "@/lib/graph/bootstrap";
import { getContext } from "@/lib/server/context";

export async function GET(_req?: Request) {
  await connection();
  const llm = process.env.LLM_API_KEY ? "configured" : "fallback";
  try {
    return Response.json({ ok: true, falkordb: "up", graph: await nodeCount((await getContext(_req)).org.graphName), llm });
  } catch {
    return Response.json({ ok: false, falkordb: "down", graph: 0, llm }, { status: 503 });
  }
}
