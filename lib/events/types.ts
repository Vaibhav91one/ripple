import { z } from "zod";

const id = z.string().min(1);
const ev = <T extends string, P extends z.ZodRawShape>(type: T, payload: P) =>
  z.object({
    type: z.literal(type),
    orgId: id,
    subject: z.object({ kind: id, id }),
    payload: z.object(payload),
    /** Same key twice = one event. Build it from the thing that happened, e.g. `ack.recorded:<changeId>:<userId>`. */
    dedupeKey: id,
  });

// Only url is required; the GitHub webhook fills the rest (changed paths feed PR Guard / Change Scout).
const prPayload = {
  url: z.url(), repo: z.string().optional(), number: z.number().optional(), action: z.string().optional(),
  title: z.string().optional(), body: z.string().optional(), author: z.string().optional(), paths: z.array(z.string()).optional(),
};

export const RippleEvent = z.discriminatedUnion("type", [
  ev("change.spotted", { changeId: id }),
  ev("change.confirmed", { changeId: id }),
  ev("change.updated", { changeId: id }),
  ev("impact.ready", { changeId: id, runId: id }),
  ev("contract.added", { contractId: id }),
  ev("conflict.found", { changeId: id, conflictsWith: id }),
  ev("brief.sent", { briefId: id, userId: id }),
  ev("ack.recorded", { changeId: id, userId: id }),
  ev("ack.missing_48h", { changeId: id, userId: id }),
  ev("ack.missing_96h", { changeId: id, userId: id }),
  ev("evidence.recorded", { changeId: id, channelId: id, teamId: z.string().optional(), personId: z.string().optional() }),
  ev("campaign.chase", { changeId: id, teamId: id, by: id }),
  ev("task.assigned", { taskId: id, userId: id }),
  ev("task.due", { taskId: id }),
  ev("task.overdue", { taskId: id }),
  ev("approval.requested", { changeId: id, approverId: id }),
  ev("access.needed", { userId: id, resource: id }),
  ev("access.granted", { userId: id, resource: id }),
  ev("pr.opened", prPayload),
  ev("pr.updated", prPayload),
  ev("digest.weekly", { weekStart: id }),
  ev("slack.inbound", { kind: z.enum(["event", "interactive", "command"]), teamId: id, body: z.unknown() }),
]);
export type RippleEvent = z.infer<typeof RippleEvent>;
