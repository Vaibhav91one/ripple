import { z } from "zod";

const n = z.coerce.number();

/** One access request in the IT queue (an :AccessRequest node). `src` + `quote` cite the sentence that makes the change need it. */
export const ItRequest = z.object({
  id: z.string(),
  personId: z.string(),
  personName: z.string().nullable(),
  teamId: z.string().nullable(),
  resourceId: z.string(),
  resourceName: z.string(),
  resourceKind: z.enum(["group", "software"]),
  decisionId: z.string(),
  changeTitle: z.string().nullable(),
  justification: z.string(),
  src: z.string().nullable(),
  quote: z.string().nullable(),
  /** Epoch seconds when the access lapses. */
  expiresAt: n,
  /** The change date: epoch seconds, or null when the change has none. The queue is sorted by it. */
  deadline: n.nullable(),
  /** Team ids that approved the request: the system owner and "it". */
  approvers: z.array(z.string()),
  status: z.enum(["open", "granted", "denied"]),
  decidedBy: z.string().nullable(),
  decidedAt: n.nullable(),
});
export type ItRequest = z.infer<typeof ItRequest>;

export const ItQueue = z.object({
  requests: z.array(ItRequest),
  /** The viewer may grant or deny (admin or lead). Ripple only records what IT did elsewhere. */
  canDecide: z.boolean(),
});
export type ItQueue = z.infer<typeof ItQueue>;

export const ItDecideBody = z.object({ ids: z.array(z.string().min(1)).min(1).max(100), verb: z.enum(["grant", "deny"]) });
export const ItDecided = z.object({ decided: z.array(z.string()), status: z.enum(["granted", "denied"]) });
export type ItDecided = z.infer<typeof ItDecided>;
