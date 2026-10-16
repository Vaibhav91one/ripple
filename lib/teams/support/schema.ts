// Support dashboard payload: KPIs, the raw rows the screen needs, and the "ripple angle" for the v1 sunset.
// Pure (zod only) so lib/api.ts and the offline mock can import it in the browser.
import { z } from "zod";
import { Kpi, Person, RippleAngle, Customer, TicketRow } from "@/lib/schemas";
import { kpi, median, type Rows } from "../util";

export const SupportPayload = z.object({
  team: z.literal("support"),
  kpis: z.array(Kpi),
  angle: RippleAngle,
  tickets: z.array(TicketRow),
  customers: z.array(Customer),
  people: z.array(Person),
});
export type SupportPayload = z.infer<typeof SupportPayload>;
/** The rows the cypher in lib/graph/queries/teams-support.cypher returns, by kind. */
export const SupportRows = SupportPayload.omit({ team: true, kpis: true, angle: true });
export type SupportRows = Rows<SupportPayload>;

function kpis(r: SupportRows, now: number): Kpi[] {
  void now;
  const open = r.tickets.filter((t) => t.status === "open");
  const breached = open.filter((t) => (t.firstResponseAt ?? now) > t.slaDueAt).length;
  const first = median(r.tickets.flatMap((t) => (t.firstResponseAt === null ? [] : [(t.firstResponseAt - t.createdAt) / 3600])));
  const v1 = open.filter((t) => t.v1Related).length;
  const weak = r.customers.filter((c) => c.healthScore < 50).length;
  return [
    kpi("open-tickets", "Open tickets", open.length, "count"),
    kpi("sla-breached", "SLA breached", breached, "count", breached > 0 ? "bad" : "ok"),
    kpi("first-response", "Median first response", first, "hours", first > 1 ? "warn" : "ok"),
    kpi("v1-tickets", "Open tickets about API v1", v1, "count", v1 > 0 ? "warn" : "ok"),
    kpi("weak-health", "Customers with health below 50", weak, "count", weak > 0 ? "warn" : "ok"),
  ];
}

export const buildSupport = (r: SupportRows, angle: RippleAngle, now: number): SupportPayload => ({
  team: "support", kpis: kpis(r, now), angle, ...r,
});
