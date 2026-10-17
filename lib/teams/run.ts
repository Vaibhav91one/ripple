// Server-only plumbing for the team dashboards: run a teams-<team>.cypher and the shared ripple-angle.cypher.
import type { z } from "zod";
import { roQuery, type Graph } from "@/lib/graph/client";
import { decisions, load, ripple } from "@/lib/graph/queries";
import type { Change, RippleAngle } from "@/lib/schemas";

const DAY = 86400;
type KindRows = { kind: string; rows: Record<string, unknown>[] };

/** Run a UNION ALL query whose branches each return `kind, rows` and group the rows by kind. */
async function byKind(g: Graph, name: string, params: Record<string, unknown>) {
  const out: Record<string, Record<string, unknown>[]> = {};
  for (const r of await roQuery<KindRows>(g, load(name).text, params)) out[r.kind] = [...(out[r.kind] ?? []), ...r.rows];
  return out;
}

/** The rows of lib/graph/queries/teams-<team>.cypher, validated by the payload's row schema. */
export async function teamRows<S extends z.ZodType>(
  g: Graph, team: string, schema: S, fix: (r: Record<string, unknown>) => unknown = (r) => r,
): Promise<z.infer<S>> {
  return schema.parse(fix(await byKind(g, `teams-${team}`, { team })));
}

type EdgeRow = { from: string; to: string; type: string; validFrom: number; validTo: number | null; src: string | null; quote: string | null };

/** The most recent decision that is not superseded; what the team pages show. Null when the org has none. */
export async function latestOpenDecisionId(g: Graph): Promise<string | null> {
  return (await decisions(g)).data.filter((d) => d.status !== "superseded").at(-1)?.id ?? null;
}

/**
 * What decision `decisionId` means for `team`: recent changes touching it that sit inside the decision's ripple,
 * its gap status and up to 3 sourced facts. A null decision (none open) is an empty, not-affected angle.
 */
export async function rippleAngle(g: Graph, team: string, now: number, decisionId: string | null): Promise<RippleAngle> {
  if (!decisionId) return { decisionId: null, affected: false, involved: false, acked: false, changes: [], facts: [] };
  const r = await byKind(g, "ripple-angle", { team, decision: decisionId, since: now - 30 * DAY });
  const inRipple = new Set((await ripple(g, decisionId, now)).nodes.map((n) => n.id)).add(decisionId);
  const gap = (r.gap?.[0] ?? {}) as { affected?: boolean; involved?: boolean; acked?: boolean };
  const changes = ((r.changes ?? []) as unknown as EdgeRow[])
    .filter((e) => e.from === decisionId || e.to === decisionId || (inRipple.has(e.from) && inRipple.has(e.to)))
    .slice(0, 8).map((e): Change => ({
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
