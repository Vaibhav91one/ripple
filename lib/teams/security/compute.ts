// Security: run lib/graph/queries/teams-security.cypher and ripple-angle.cypher, then build the typed payload.
import type { Graph } from "@/lib/graph/client";
import { rippleAngle, teamRows } from "../run";
import { buildSecurity, SecurityRows, type SecurityPayload } from "./schema";

export async function computeSecurity(g: Graph, now: number): Promise<SecurityPayload> {
  const rows = await teamRows(g, "security", SecurityRows);
  return buildSecurity(rows, await rippleAngle(g, "security", now), now);
}
