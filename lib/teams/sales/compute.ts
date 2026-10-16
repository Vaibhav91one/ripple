// Sales: run lib/graph/queries/teams-sales.cypher and ripple-angle.cypher, then build the typed payload.
import type { Graph } from "@/lib/graph/client";
import { rippleAngle, teamRows } from "../run";
import { buildSales, SalesRows, type SalesPayload } from "./schema";

export async function computeSales(g: Graph, now: number): Promise<SalesPayload> {
  const rows = await teamRows(g, "sales", SalesRows);
  return buildSales(rows, await rippleAngle(g, "sales", now), now);
}
