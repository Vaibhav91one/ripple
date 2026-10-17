// Leadership: run lib/graph/queries/teams-leadership.cypher and ripple-angle.cypher, then build the typed payload.
import type { Graph } from "@/lib/graph/client";
import { rippleAngle, teamRows } from "../run";
import { buildLeadership, LeadershipRows, type LeadershipPayload } from "./schema";

export async function computeLeadership(g: Graph, now: number, decisionId: string | null): Promise<LeadershipPayload> {
  const rows = await teamRows(g, "leadership", LeadershipRows);
  return buildLeadership(rows, await rippleAngle(g, "leadership", now, decisionId), now);
}
