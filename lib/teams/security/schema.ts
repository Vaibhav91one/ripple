// Security dashboard payload: KPIs, the raw rows the screen needs, and the "ripple angle" for the v1 sunset.
// Pure (zod only) so lib/api.ts and the offline mock can import it in the browser.
import { z } from "zod";
import { Kpi, Person, RippleAngle, Control, Finding, Framework, Risk, Task, Vendor } from "@/lib/schemas";
import { restrictedField } from "@/lib/schemas/common";
import { kpi, type Rows } from "../util";

export const SecurityPayload = z.object({
  team: z.literal("security"),
  /** Epoch seconds the SLA and review dates are judged against. */
  now: z.number().int(),
  kpis: z.array(Kpi),
  angle: RippleAngle,
  ...restrictedField,
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
export const SecurityRows = SecurityPayload.omit({ team: true, restricted: true, now: true, kpis: true, angle: true });
export type SecurityRows = Omit<Rows<SecurityPayload>, "now">;

const pct = (n: number, d: number) => (d ? Math.round((n / d) * 100) : 100);

/** Share of each framework's controls that pass (the readiness bars). */
export const frameworkReadiness = (r: Pick<SecurityRows, "controls" | "frameworks">) =>
  r.frameworks.map((f) => {
    const cs = r.controls.filter((c) => c.frameworkId === f.id);
    return { id: f.id, name: f.name, percent: pct(cs.filter((c) => c.status === "passing").length, cs.length), total: cs.length };
  });

function kpis(r: SecurityRows): Kpi[] {
  const passRate = pct(r.controls.filter((c) => c.status === "passing").length, r.controls.length);
  const fw = frameworkReadiness(r);
  const readiness = fw.length ? Math.round(fw.reduce((a, f) => a + f.percent, 0) / fw.length) : 100;
  const critical = r.findings.filter((f) => f.severity === "critical" && f.status !== "resolved").length;
  const blockers = r.controls.filter((c) => c.status === "failing" && c.auditBlocking).length;
  return [
    kpi("control-pass-rate", "Control pass rate", passRate, "percent", passRate < 80 ? "warn" : "ok"),
    kpi("framework-readiness", "Framework readiness", readiness, "percent", readiness < 80 ? "warn" : "ok"),
    kpi("critical-findings", "Critical findings", critical, "count", critical > 0 ? "bad" : "ok"),
    kpi("audit-blockers", "Audit blockers", blockers, "count", blockers > 0 ? "bad" : "ok"),
  ];
}

export const buildSecurity = (r: SecurityRows, angle: RippleAngle, now: number): SecurityPayload => ({
  team: "security", now, kpis: kpis(r), angle, ...r,
});
