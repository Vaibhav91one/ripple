// Eng: run lib/graph/queries/teams-eng.cypher and ripple-angle.cypher, then build the typed payload.
import type { Graph } from "@/lib/graph/client";
import { rippleAngle, teamRows } from "../run";
import { buildEng, EngRows, type EngPayload } from "./schema";

export async function computeEng(g: Graph, now: number, decisionId: string | null): Promise<EngPayload> {
  const rows = await teamRows(g, "eng", EngRows);
  return buildEng(rows, await rippleAngle(g, "eng", now, decisionId), now);
}
