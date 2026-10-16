// Security dashboard payload: KPIs, the raw rows the screen needs, and the "ripple angle" for the v1 sunset.
// Pure (zod only) so lib/api.ts and the offline mock can import it in the browser.
import { z } from "zod";
import { Kpi, Person, RippleAngle, Control, Finding, Framework, Risk, Task, Vendor } from "@/lib/schemas";
import { kpi, type Rows } from "../util";

export const SecurityPayload = z.object({
  team: z.literal("security"),
  kpis: z.array(Kpi),
  angle: RippleAngle,
  controls: z.array(Control),
  frameworks: z.array(Framework),
  findings: z.array(Finding),
  vendors: z.array(Vendor),
  risks: z.array(Risk),
  tasks: z.array(Task),
  people: z.array(Person),
});
export type SecurityPayload = z.infer<typeof SecurityPayload>;
/** The rows the cypher in lib/graph/queries/teams-security.cypher returns, by kind. */
export const SecurityRows = SecurityPayload.omit({ team: true, kpis: true, angle: true });
export type SecurityRows = Rows<SecurityPayload>;

function kpis(r: SecurityRows, now: number): Kpi[] {
  void now;
  const failing = r.controls.filter((c) => c.status === "failing");
  const blocking = failing.filter((c) => c.auditBlocking).length;
  const openF = r.findings.filter((f) => f.status !== "resolved");
  const overdue = openF.filter((f) => f.slaDueAt < now).length;
  const vendors = r.vendors.filter((v) => v.assessmentStatus !== "current").length;
  const tasks = r.tasks.filter((t) => t.status !== "done").length;
  return [
    kpi("failing-controls", "Failing controls", failing.length, "count", failing.length > 0 ? "warn" : "ok"),
    kpi("audit-blockers", "Audit-blocking controls failing", blocking, "count", blocking > 0 ? "bad" : "ok"),
    kpi("open-findings", "Open findings", openF.length, "count", openF.length > 0 ? "warn" : "ok"),
    kpi("overdue-findings", "Findings past SLA", overdue, "count", overdue > 0 ? "bad" : "ok"),
    kpi("vendor-reviews", "Vendors due or overdue for review", vendors, "count", vendors > 0 ? "warn" : "ok"),
    kpi("grc-tasks", "Open questionnaires and access reviews", tasks, "count"),
  ];
}

export const buildSecurity = (r: SecurityRows, angle: RippleAngle, now: number): SecurityPayload => ({
  team: "security", kpis: kpis(r, now), angle, ...r,
});
