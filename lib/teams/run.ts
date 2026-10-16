// Server-only plumbing for the team dashboards: run a teams-<team>.cypher and the shared ripple-angle.cypher.
import type { z } from "zod";
import { query, type Graph } from "@/lib/graph/client";
import { load } from "@/lib/graph/queries";
import type { Change, RippleAngle } from "@/lib/schemas";

const DAY = 86400;
type KindRows = { kind: string; rows: Record<string, unknown>[] };

/** Run a UNION ALL query whose branches each return `kind, rows` and group the rows by kind. */
async function byKind(g: Graph, name: string, params: Record<string, unknown>) {
  const out: Record<string, Record<string, unknown>[]> = {};
  for (const r of await query<KindRows>(g, load(name).text, params)) out[r.kind] = [...(out[r.kind] ?? []), ...r.rows];
  return out;
}

/** The rows of lib/graph/queries/teams-<team>.cypher, validated by the payload's row schema. */
export async function teamRows<S extends z.ZodType>(
  g: Graph, team: string, schema: S, fix: (r: Record<string, unknown>) => unknown = (r) => r,
): Promise<z.infer<S>> {
  return schema.parse(fix(await byKind(g, `teams-${team}`, { team })));
}

type EdgeRow = { from: string; to: string; type: string; validFrom: number; validTo: number | null; src: string | null; quote: string | null };

/** What decision `decisionId` means for `team`: recent changes touching it, its gap status and up to 3 sourced facts. */
export async function rippleAngle(g: Graph, team: string, now: number, decisionId = "d-1"): Promise<RippleAngle> {
  const r = await byKind(g, "ripple-angle", { team, decision: decisionId, since: now - 30 * DAY });
  const gap = (r.gap?.[0] ?? {}) as { affected?: boolean; involved?: boolean; acked?: boolean };
  const changes = ((r.changes ?? []) as unknown as EdgeRow[]).map((e): Change => ({
    kind: "added", at: e.validFrom,
    edge: {
      from: e.from, to: e.to, type: e.type as Change["edge"]["type"], validFrom: e.validFrom, validTo: e.validTo,
      ...(e.src && e.quote ? { src: { artifactId: e.src, quote: e.quote } } : {}),
    },
  }));
  const facts = ((r.facts ?? []) as { text: string; src: string; quote: string }[]).slice(0, 3)
    .map((f) => ({ text: f.text, source: { artifactId: f.src, quote: f.quote } }));
  return { decisionId, affected: !!gap.affected, involved: !!gap.involved, acked: !!gap.acked, changes, facts };
}
