import { z } from "zod";
import { RestrictedSummary } from "./common";
import { WhoKnowsRow } from "./teams";

// `label` is on every node-like object so redaction keeps the topology and hides only the title (see permissions/redact.ts).
// A hidden title parses back as "Restricted".
const title = z.string().default("Restricted");
const Ref = z.object({ id: z.string(), label: z.string(), title });

export const ItemEdge = z.object({
  type: z.string(),
  dir: z.enum(["out", "in"]),
  other: Ref,
  validFrom: z.number().int(),
  validTo: z.number().int().nullable(),
  src: z.string().nullable(),
  quote: z.string().nullable(),
});
export const ItemWhy = z.object({
  changeId: z.string(),
  changeTitle: z.string(),
  changeStatus: z.string().nullable(),
  path: z.array(z.object({ id: z.string(), label: z.string(), name: z.string().nullish() })),
  rels: z.array(z.object({ type: z.string(), src: z.string().nullable(), quote: z.string().nullable() })),
});
/** An agent finding about this node (#210). A finding derived from sources you may not see arrives with empty text (redaction) and is not shown. */
export const ItemFinding = z.object({
  id: z.string(), text: z.string(), at: z.number().int(), agent: z.string().nullable(), confidence: z.number().nullable(), sources: z.array(z.string()).nullable().transform((s) => s ?? []),
});
/** GET /api/items/[kind]/[id]: everything about one graph node, permission-aware. */
export const ItemView = z.object({
  kind: z.string(),
  id: z.string(),
  label: z.string(), // "Ticket", "Contract"...
  icon: z.string(),
  title,
  status: z.string().nullable(),
  owner: z.string().nullable(),
  sourceUrl: z.string().nullable(),
  why: z.array(ItemWhy),
  neighbours: z.array(Ref.extend({ type: z.string(), dir: z.enum(["out", "in"]) })),
  edges: z.array(ItemEdge),
  findings: z.array(ItemFinding).default([]).transform((fs) => fs.filter((f) => f.text)),
  whoKnows: z.array(WhoKnowsRow.extend({ evidence: z.array(z.string()), score: z.number() })),
  // the summaries; redaction first stamps a restricted artifact with its owner team id (a string), which handle() then replaces
  restricted: z.union([z.array(RestrictedSummary), z.string()]).optional(),
});
export type ItemView = z.infer<typeof ItemView>;
