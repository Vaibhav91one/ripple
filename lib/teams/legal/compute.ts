// Legal: run lib/graph/queries/teams-legal.cypher and ripple-angle.cypher, then build the typed payload.
import type { Graph } from "@/lib/graph/client";
import { rippleAngle, teamRows } from "../run";
import { buildLegal, LegalRows, type LegalPayload } from "./schema";

export async function computeLegal(g: Graph, now: number, decisionId: string | null): Promise<LegalPayload> {
  const rows = await teamRows(g, "legal", LegalRows);
  return buildLegal(rows, await rippleAngle(g, "legal", now, decisionId), now);
}
