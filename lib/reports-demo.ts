// Seeded demo history for the Ledgerly change d-1: the steps a live org would have in its event log (graph traversal, agent
// proposals, approvals, notices, a GitHub issue). Every row is marked demo and source "demo"; a real row of the same kind replaces it.
// Derived from the graph's own announcement time so the story is stable. ponytail: constants, move into seed.ts if it needs to be queryable.
import type { RippleResult } from "./schemas";
import type { TimelineEvent } from "./schemas/reports";

export const DEMO_CUSTOMERS_NOTIFIED = 12;
const H = 3600;

export function demoEvents(caseId: string, announcedAt: number, rip: RippleResult): TimelineEvent[] {
  const e = (id: string, dt: number, kind: TimelineEvent["kind"], type: "person" | "agent" | "system", name: string, teamId: string | null, text: string): TimelineEvent =>
    ({ id: `demo-${caseId}-${id}`, at: announcedAt + dt, kind, actor: { type, id: null, name }, teamId, text, source: "demo", demo: true });
  const c = rip.counts;
  if (caseId !== "d-1") return [e("trav", 60, "traversed", "system", "Ripple", null, `Ripple traced ${c.teamsAffected} teams, ${c.customers} customers and ${c.contracts} contracts behind the change`)];
  return [
    e("trav", 60, "traversed", "system", "Ripple", null, `Ripple traced ${c.teamsAffected} teams, ${c.customers} customers and ${c.contracts} contracts behind the change`),
    e("prop", 26 * H, "proposed", "agent", "Customer-comms agent", "sales", "Drafted a customer notice for the affected customers"),
    e("appr", 30 * H, "approved", "person", "Sales lead", "sales", "Approved the customer notice"),
    e("note", 31 * H, "notified", "system", "Ripple", "sales", `Notice sent to ${DEMO_CUSTOMERS_NOTIFIED} customers`),
    e("issue", 52 * H, "issue", "system", "GitHub", "eng", "Opened issue: migrate internal callers off the retired API"),
  ];
}
