// Marking a Task done. The one place a task completes; it emits task.done so the Courier refreshes the campaign tracker.
import { env } from "./env";
import { emit } from "./events/emit";
import { query, roQuery } from "./graph/client";
import { NotFound } from "./graph/queries";
import { Forbidden } from "./server/route";
import type { Context } from "./server/context";

/** The assignee, or an admin, lead or change owner, may complete a task. */
export async function completeTask(ctx: Context, taskId: string): Promise<{ id: string; status: "done" }> {
  const [k] = await roQuery<{ assigneeId: string | null; status: string }>(ctx.graph, "MATCH (k:Task {id: $id}) RETURN k.assigneeId AS assigneeId, k.status AS status", { id: taskId });
  if (!k) throw new NotFound(`task ${taskId}`);
  const v = ctx.viewer;
  if (!(v.kind === "user" && (v.role !== "member" || (!!v.personId && v.personId === k.assigneeId)))) throw new Forbidden("only the assignee, a lead or an admin can complete this task");
  const moved = await query<{ id: string }>(ctx.writer(), "MATCH (k:Task {id: $id}) WHERE k.status <> 'done' SET k.status = 'done', k.doneAt = $now RETURN k.id AS id", { id: taskId, now: ctx.now });
  if (moved.length && env().DATABASE_URL) await emit((await import("./db")).db(), { type: "task.done", orgId: ctx.org.id, subject: { kind: "task", id: taskId }, payload: { taskId }, dedupeKey: `task.done:${taskId}` });
  await ctx.audit({ action: "task.done", resourceType: "task", resourceId: taskId, meta: { changed: moved.length } });
  return { id: taskId, status: "done" };
}
