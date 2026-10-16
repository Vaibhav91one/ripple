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

/** Share of each SDK's users off its oldest listed line (the v1-era major), averaged over SDKs. */
export function v2Adoption(s: DocsStats): number {
  const bySdk = new Map<string, DocsStats["sdkAdoption"]>();
  for (const x of s.sdkAdoption) bySdk.set(x.sdk, [...(bySdk.get(x.sdk) ?? []), x]);
  const shares = [...bySdk.values()].map((rows) => 100 - rows[rows.length - 1].share);
  return shares.length ? Math.round(shares.reduce((a, b) => a + b, 0) / shares.length) : 0;
}

function kpis(r: DevRelRows, now: number): Kpi[] {
  void now;
  const up = r.pages.reduce((a, p) => a + p.feedbackUp, 0);
  const down = r.pages.reduce((a, p) => a + p.feedbackDown, 0);
  const views = r.pages.reduce((a, p) => a + p.views30d, 0);
  const failed = r.docsStats.failedSearches.reduce((a, s) => a + s.count, 0);
  return [
    kpi("docs-views", "Docs views, 30 days", views, "count"),
    kpi("failed-searches", "Failed docs searches", failed, "count", failed > 100 ? "warn" : "ok"),
    kpi("feedback", "Feedback score", up + down === 0 ? 0 : Math.round((100 * up) / (up + down)), "percent"),
    kpi("v2-sdk", "v2 SDK adoption", v2Adoption(r.docsStats), "percent", "warn"),
  ];
}

export const buildDevRel = (r: DevRelRows, angle: RippleAngle, now: number): DevRelPayload => ({
  team: "devrel", kpis: kpis(r, now), angle, ...r,
});
