// One shape for every source: authenticate, sync incrementally, receive webhooks, map records to graph proposals.
import { z } from "zod";
import type { RippleEvent } from "../events/types";

// Labels and edge types are interpolated into Cypher, so they come from these checks only.
export const NODE_LABELS = ["Task", "Person", "Team", "System", "Customer"] as const;
const Label = z.enum(NODE_LABELS);
const Ref = z.object({ label: Label, id: z.string().min(1) });
const Props = z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).refine((p) => !("id" in p), "props.id is not allowed").default({});
const base = {
  props: Props,
  /** Where it came from, e.g. `github:pr/12`. */
  src: z.string().min(1),
  quote: z.string().optional(),
  confidence: z.number().min(0).max(1),
  /** true = the source states it outright (an IdP group, a PR author): applied directly. false = inferred: a person approves it first. */
  structured: z.boolean(),
};
const EdgeType = z.string().regex(/^[A-Z][A-Z_]*$/);

export const GraphProposal = z.discriminatedUnion("op", [
  z.object({ op: z.literal("merge_node"), label: Label, id: z.string().min(1), ...base }),
  z.object({ op: z.literal("merge_edge"), type: EdgeType, from: Ref, to: Ref, ...base }),
  z.object({ op: z.literal("end_edge"), type: EdgeType, from: Ref, to: Ref, ...base }),
]);
export type GraphProposal = z.input<typeof GraphProposal>;

/** A connector_account row with its token decrypted. */
export type Account = { id: string; orgId: string; kind: string; externalId: string; token: string | null; scopes: string[] };
export type SyncPage = { records: unknown[]; nextCursor: unknown };

export type Connector = {
  kind: string;
  auth: "app" | "oauth" | "upload" | "apikey";
  /** Pages from `cursor` (null = first sync). `nextCursor` is stored after each page, so an interrupted sync resumes there. */
  sync?(acct: Account, cursor: unknown): AsyncIterable<SyncPage>;
  /** Verify the signature (throw when bad) and turn the delivery into events. Each dedupeKey must contain the provider's delivery id. */
  webhook?(req: Request, acct: Account): Promise<RippleEvent[] | "ignored">;
  map(record: unknown, ctx: { acct: Account }): GraphProposal[];
};

export const defineConnector = (c: Connector): Connector => c;
