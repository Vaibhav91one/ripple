// Server-side team registry: team id -> compute(graph, now). The pure schemas live in ./dashboards.
import type { Graph } from "@/lib/graph/client";
import { computeEng } from "./eng/compute";
import { computeSupport } from "./support/compute";
import { computeSales } from "./sales/compute";
import { computeLegal } from "./legal/compute";
import { computeSecurity } from "./security/compute";
import { computeDevRel } from "./devrel/compute";
import { computeLeadership } from "./leadership/compute";
import type { TeamDashboard, TeamId } from "./dashboards";

export { TEAM_IDS, TeamDashboard, TeamId } from "./dashboards";

export const registry: Record<TeamId, (g: Graph, now: number) => Promise<TeamDashboard>> = {
  eng: computeEng,
  support: computeSupport,
  sales: computeSales,
  legal: computeLegal,
  security: computeSecurity,
  devrel: computeDevRel,
  leadership: computeLeadership,
};
