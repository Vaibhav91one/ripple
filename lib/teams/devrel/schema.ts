// DevRel dashboard payload: KPIs, the raw rows the screen needs, and the "ripple angle" for the v1 sunset.
// Pure (zod only) so lib/api.ts and the offline mock can import it in the browser.
import { z } from "zod";
import { Kpi, Person, RippleAngle, DocsStats, Page, System, Task } from "@/lib/schemas";
import { kpi, type Rows } from "../util";

export const DevRelPayload = z.object({
  team: z.literal("devrel"),
  kpis: z.array(Kpi),
  angle: RippleAngle,
  pages: z.array(Page),
  docsStats: DocsStats,
  sdks: z.array(System),
  tasks: z.array(Task),
  people: z.array(Person),
});
export type DevRelPayload = z.infer<typeof DevRelPayload>;
/** The rows the cypher in lib/graph/queries/teams-devrel.cypher returns, by kind. */
export const DevRelRows = DevRelPayload.omit({ team: true, kpis: true, angle: true });
export type DevRelRows = Rows<DevRelPayload>;

function kpis(r: DevRelRows, now: number): Kpi[] {
  void now;
  const up = r.pages.reduce((a, p) => a + p.feedbackUp, 0);
  const down = r.pages.reduce((a, p) => a + p.feedbackDown, 0);
  const v1Views = r.pages.filter((p) => p.v1Related).reduce((a, p) => a + p.views30d, 0);
  const failed = r.docsStats.failedSearches.reduce((a, s) => a + s.count, 0);
  const tasks = r.tasks.filter((t) => t.status !== "done").length;
  return [
    kpi("v1-views", "Views of v1 docs, 30 days", v1Views, "count", v1Views > 0 ? "warn" : "ok"),
    kpi("helpful", "Pages rated helpful", up + down === 0 ? 0 : Math.round((100 * up) / (up + down)), "percent"),
    kpi("failed-searches", "Failed docs searches", failed, "count", failed > 100 ? "warn" : "ok"),
    kpi("docs-tasks", "Open docs tasks", tasks, "count"),
  ];
}

export const buildDevRel = (r: DevRelRows, angle: RippleAngle, now: number): DevRelPayload => ({
  team: "devrel", kpis: kpis(r, now), angle, ...r,
});
