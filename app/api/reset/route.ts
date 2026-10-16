import { connection } from "next/server";
import { resetDemo } from "@/lib/graph/bootstrap";

export async function POST(req: Request) {
  await connection();
  const token = process.env.RESET_TOKEN;
  if (!token || req.headers.get("x-reset-token") !== token)
    return Response.json({ error: "unauthorized" }, { status: 401 });
  try {
    await resetDemo();
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ ok: false, error: e instanceof Error ? e.message : "failed" }, { status: 503 });
  }
}
