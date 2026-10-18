import { z } from "zod";
import { noPersist, owner } from "@/lib/assistant/owner";

// Conversation threads for signed-in orgs with Postgres. Demo (and self-host without accounts): `{persist:false}`, the client keeps threads in localStorage.
export async function GET(): Promise<Response> {
  const o = await owner();
  if (!o) return noPersist();
  const { listConversations } = await import("@/lib/assistant/store");
  return Response.json({ persist: true, conversations: await listConversations(o) });
}

const Create = z.object({ title: z.string().trim().min(1).max(80), agent: z.string().max(40).optional() });
export async function POST(req: Request): Promise<Response> {
  const o = await owner();
  if (!o) return noPersist();
  const b = Create.safeParse(await req.json().catch(() => null));
  if (!b.success) return Response.json({ error: "Send {title, agent?}." }, { status: 400 });
  const { createConversation } = await import("@/lib/assistant/store");
  return Response.json({ persist: true, conversation: await createConversation(o, b.data.title, b.data.agent) }, { status: 201 });
}
