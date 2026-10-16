// Legal dashboard payload: KPIs, the raw rows the screen needs, and the "ripple angle" for the v1 sunset.
// Pure (zod only) so lib/api.ts and the offline mock can import it in the browser.
import { z } from "zod";
import { Kpi, Person, RippleAngle, Clause, Contract } from "@/lib/schemas";
import { kpi, type Rows } from "../util";

export const LegalPayload = z.object({
  team: z.literal("legal"),
  kpis: z.array(Kpi),
  angle: RippleAngle,
  now: z.number(),
  contracts: z.array(Contract),
  clauses: z.array(Clause),
  people: z.array(Person),
});
export type LegalPayload = z.infer<typeof LegalPayload>;
/** The rows the cypher in lib/graph/queries/teams-legal.cypher returns, by kind. */
export const LegalRows = LegalPayload.omit({ team: true, kpis: true, angle: true, now: true });
export type LegalRows = Omit<Rows<LegalPayload>, "now">;

const DAY = 86400;
/** Contracts whose end (renewal) date falls within the next `days` days. */
export const renewalsWithin = (contracts: Contract[], now: number, days: number) =>
  contracts.filter((c) => c.endsAt >= now && c.endsAt <= now + days * DAY).sort((a, b) => a.endsAt - b.endsAt);
/** Clauses that carry a due date are obligations Ledgerly must deliver. */
export const obligations = (clauses: Clause[]) => clauses.filter((c) => c.dueAt !== null).sort((a, b) => a.dueAt! - b.dueAt!);

// ponytail: the contract model has no approval timestamps, so "average approval cycle" is shown as contracts still awaiting approval.
function kpis(r: LegalRows, now: number): Kpi[] {
  const high = r.clauses.filter((c) => c.risk === "high").length;
  const ren = renewalsWithin(r.contracts, now, 90).length;
  const open = obligations(r.clauses).length;
  const pending = r.contracts.filter((c) => c.approvalState === "draft" || c.approvalState === "in_review").length;
  return [
    kpi("renewals-90d", "Renewals in 90 days", ren, "count", ren > 0 ? "warn" : "ok"),
    kpi("obligations", "Open obligations", open, "count"),
    kpi("high-risk", "High-risk clauses", high, "count", high > 0 ? "bad" : "ok"),
    kpi("approvals", "Awaiting approval", pending, "count", pending > 0 ? "warn" : "ok"),
  ];
}

export const buildLegal = (r: LegalRows, angle: RippleAngle, now: number): LegalPayload => ({
  team: "legal", kpis: kpis(r, now), angle, now, ...r,
});
