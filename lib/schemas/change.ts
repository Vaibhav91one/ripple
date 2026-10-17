import { z } from "zod";
import { id, ts } from "./common";

export const ChangeKind = z.enum(["decision", "rfc", "pr", "pricing", "policy", "rollout", "announcement", "contract"]);
export const ChangeStatus = z.enum(["draft", "confirmed", "superseded", "cancelled"]);

/**
 * A Change node (label `:Change`; seeded Decisions are `:Change:Decision`). Named `ChangeNode` because `Change`
 * is already the ripple feed's added/ended edge event. Seeded decisions keep their legacy `status`
 * (proposed|accepted) so existing queries are untouched; it maps to draft|confirmed here.
 */
export const ChangeNode = z.object({
  id,
  kind: ChangeKind,
  title: z.string(),
  status: z.preprocess((s) => ({ proposed: "draft", accepted: "confirmed" })[s as string] ?? s, ChangeStatus),
  effectiveAt: ts,
  owner: id.nullable().default(null),
  sourceRef: id.nullable().default(null),
  quote: z.string().nullable().default(null),
});
export type ChangeNode = z.infer<typeof ChangeNode>;
