// Legal dashboard payload: KPIs, the raw rows the screen needs, and the "ripple angle" for the v1 sunset.
// Pure (zod only) so lib/api.ts and the offline mock can import it in the browser.
import { z } from "zod";
import { Kpi, Person, RippleAngle, Clause, Contract } from "@/lib/schemas";
import { kpi, type Rows } from "../util";

export const LegalPayload = z.object({
  team: z.literal("legal"),
  kpis: z.array(Kpi),
  angle: RippleAngle,
  contracts: z.array(Contract),
  clauses: z.array(Clause),
  people: z.array(Person),
});
export type LegalPayload = z.infer<typeof LegalPayload>;
/** The rows the cypher in lib/graph/queries/teams-legal.cypher returns, by kind. */
export const LegalRows = LegalPayload.omit({ team: true, kpis: true, angle: true });
export type LegalRows = Rows<LegalPayload>;

function kpis(r: LegalRows, now: number): Kpi[] {
  void now;
  const high = r.clauses.filter((c) => c.risk === "high").length;
  const due = r.clauses.filter((c) => c.dueAt !== null && c.dueAt >= now && c.dueAt <= now + 30 * 86400).length;
  const pending = r.contracts.filter((c) => c.approvalState === "draft" || c.approvalState === "in_review").length;
  const guarantees = r.clauses.filter((c) => c.text.includes("guarantees availability of API v1")).length;
  return [
    kpi("contracts", "Contracts", r.contracts.length, "count"),
    kpi("high-risk", "High-risk clauses", high, "count", high > 0 ? "bad" : "ok"),
    kpi("obligations", "Obligations due in 30 days", due, "count", due > 0 ? "warn" : "ok"),
    kpi("approvals", "Awaiting approval", pending, "count", pending > 0 ? "warn" : "ok"),
    kpi("v1-guarantees", "Contracts guaranteeing API v1", guarantees, "count", guarantees > 0 ? "bad" : "ok"),
  ];
}

export const buildLegal = (r: LegalRows, angle: RippleAngle, now: number): LegalPayload => ({
  team: "legal", kpis: kpis(r, now), angle, ...r,
});
