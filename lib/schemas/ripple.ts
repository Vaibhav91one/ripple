import { z } from "zod";
import { id, restrictedField, ts } from "./common";
import { Conflict, Decision, Edge, EdgeType, Source } from "./core";

export const RippleNode = z.object({
  id,
  label: z.string(),
  kind: z.enum([
    "team",
    "person",
    "decision",
    "system",
    "customer",
    "ticket",
    "deal",
    "contract",
  ]),
  hop: z.number().int().min(0),
});
export const RippleTeam = z.object({
  teamId: id,
  why: z.array(z.object({ reason: z.string(), ref: id, source: Source })),
  involved: z.boolean(),
  acked: z.boolean(),
});
export const RippleResult = z.object({
  decision: Decision,
  nodes: z.array(RippleNode),
  edges: z.array(z.object({ from: id, to: id, type: EdgeType })),
  teams: z.array(RippleTeam),
  gap: z.array(id),
  conflicts: z.array(Conflict),
  counts: z.object({
    teamsAffected: z.number().int(), // excludes the deciding team
    notTold: z.number().int(),
    conflicts: z.number().int(),
    customers: z.number().int(),
    tickets: z.number().int(),
    deals: z.number().int(),
    contracts: z.number().int(),
    /** null = customer ARR is restricted to Sales (leadership sees the total) */
    arrAtRisk: z.number().int().nullable(),
  }),
  cypher: z.array(z.object({ name: z.string(), text: z.string() })),
  ...restrictedField,
});

export const Brief = z.object({
  teamId: id,
  decisionId: id,
  claims: z.array(z.object({ text: z.string(), sources: z.array(Source) })),
});
export const Change = z.object({
  edge: Edge,
  kind: z.enum(["added", "ended"]),
  at: ts,
});

export type RippleResult = z.infer<typeof RippleResult>;
export type Brief = z.infer<typeof Brief>;
export type Change = z.infer<typeof Change>;
