// Support: run lib/graph/queries/teams-support.cypher and ripple-angle.cypher, then build the typed payload.
import type { Graph } from "@/lib/graph/client";
import { rippleAngle, teamRows } from "../run";
import { buildSupport, SupportRows, type SupportPayload } from "./schema";

export async function computeSupport(g: Graph, now: number, decisionId: string | null): Promise<SupportPayload> {
  const rows = await teamRows(g, "support", SupportRows);
  return buildSupport(rows, await rippleAngle(g, "support", now, decisionId), now);
}
