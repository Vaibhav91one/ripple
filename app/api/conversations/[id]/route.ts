import { z } from "zod";
import { noPersist, owner } from "@/lib/assistant/owner";

type P = { params: Promise<{ id: string }> };
const missing = () => Response.json({ error: "No such conversation." }, { status: 404 });

export async function GET(_: Request, { params }: P): Promise<Response> {
  const o = await owner();
  if (!o) return noPersist();
  const { getConversation } = await import("@/lib/assistant/store");
  const c = await getConversation(o, (await params).id);
  return c ? Response.json({ persist: true, conversation: c }) : missing();
}

export async function PATCH(req: Request, { params }: P): Promise<Response> {
  const o = await owner();
  if (!o) return noPersist();
  const b = z.object({ title: z.string().trim().min(1).max(80) }).safeParse(await req.json().catch(() => null));
  if (!b.success) return Response.json({ error: "Send {title}." }, { status: 400 });
  const { renameConversation } = await import("@/lib/assistant/store");
  const c = await renameConversation(o, (await params).id, b.data.title);
  return c ? Response.json({ persist: true, conversation: c }) : missing();
}

export async function DELETE(_: Request, { params }: P): Promise<Response> {
  const o = await owner();
  if (!o) return noPersist();
  const { deleteConversation } = await import("@/lib/assistant/store");
  return (await deleteConversation(o, (await params).id)) ? Response.json({ persist: true, deleted: true }) : missing();
}
