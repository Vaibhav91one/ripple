// DevRel: run lib/graph/queries/teams-devrel.cypher and ripple-angle.cypher, then build the typed payload.
import type { Graph } from "@/lib/graph/client";
import { rippleAngle, teamRows } from "../run";
import { buildDevRel, DevRelRows, type DevRelPayload } from "./schema";

export async function computeDevRel(g: Graph, now: number, decisionId: string | null): Promise<DevRelPayload> {
  // docs stats are stored as JSON strings on the node (a property cannot hold a map)
  const rows = await teamRows(g, "devrel", DevRelRows, (r) => {
    const d = (r.docsStats as Record<string, string>[])[0];
    return { ...r, docsStats: { id: d.id, failedSearches: JSON.parse(d.failedSearches), sdkAdoption: JSON.parse(d.sdkAdoption) } };
  });
  return buildDevRel(rows, await rippleAngle(g, "devrel", now, decisionId), now);
}
