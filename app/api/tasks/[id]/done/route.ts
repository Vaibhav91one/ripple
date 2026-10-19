import { z } from "zod";
import { handle } from "@/lib/server/route";
import { completeTask } from "@/lib/tasks";

/** Mark a task done (assignee, lead or admin). Emits task.done; the Courier then proposes a tracker refresh. */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return handle(z.object({ id: z.string(), status: z.literal("done") }), (ctx) => completeTask(ctx, id), { action: "task.done", resourceId: id });
}
