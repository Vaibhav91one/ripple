import { connection } from "next/server";
import { nodeCount } from "@/lib/graph/bootstrap";

export async function GET() {
  await connection();
  const llm = process.env.LLM_API_KEY ? "configured" : "fallback";
  try {
    return Response.json({ ok: true, falkordb: "up", graph: await nodeCount(), llm });
  } catch {
    return Response.json({ ok: false, falkordb: "down", graph: 0, llm }, { status: 503 });
  }
}
