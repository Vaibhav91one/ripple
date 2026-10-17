// Support dashboard payload: KPIs, the raw rows the screen needs, and the "ripple angle" for the v1 sunset.
// Pure (zod only) so lib/api.ts and the offline mock can import it in the browser.
import { z } from "zod";
import { Kpi, Person, RippleAngle, Customer, TicketRow } from "@/lib/schemas";
import { restrictedField } from "@/lib/schemas/common";
import { kpi, median, type Rows } from "../util";

export const SupportPayload = z.object({
  team: z.literal("support"),
  kpis: z.array(Kpi),
  angle: RippleAngle,
  ...restrictedField,
  now: z.number(),
  tickets: z.array(TicketRow),
  customers: z.array(Customer),
  people: z.array(Person),
  /** ids of customers that use API v1 (USES edge) */
  v1CustomerIds: z.array(z.string()),
  /** CSAT %, one point per day for the last 14 days, derived from SLA outcomes (no survey data yet) */
  csat: z.array(z.number()),
});
export type SupportPayload = z.infer<typeof SupportPayload>;
/** The rows the cypher in lib/graph/queries/teams-support.cypher returns, by kind. */
export const SupportRows = SupportPayload.omit({ team: true, restricted: true, kpis: true, angle: true, now: true, csat: true });
export type SupportRows = Omit<Rows<SupportPayload>, "csat" | "now">;

const H = 3600;
const DAY = 86400;
/** A ticket's SLA state at `now`: waiting tickets count down to slaDueAt; answered ones are met or breached. */
export function slaState(t: TicketRow, now: number): { kind: "breached" | "risk" | "ok" | "met"; seconds: number } {
  const seconds = t.slaDueAt - now;
  if (t.firstResponseAt !== null) return { kind: t.firstResponseAt > t.slaDueAt ? "breached" : "met", seconds: 0 };
  return { kind: seconds < 0 ? "breached" : seconds < 4 * H ? "risk" : "ok", seconds };
}
/** "2h 10m left" / "5h 3m over" */
export function fmtSla(s: { kind: string; seconds: number }): string {
  if (s.kind === "met") return "Met";
  if (s.kind === "breached" && s.seconds === 0) return "Breached";
  const a = Math.abs(s.seconds), h = Math.floor(a / H), d = Math.floor(h / 24);
  const t = d >= 1 ? `${d}d ${h % 24}h` : h >= 1 ? `${h}h ${Math.floor((a % H) / 60)}m` : `${Math.max(1, Math.floor(a / 60))}m`;
  return s.seconds < 0 ? `${t} over` : `${t} left`;
}

/** 14 daily points: 96% minus 30 points per share of that week's tickets that missed their SLA. */
function csatSeries(tickets: TicketRow[], now: number): number[] {
  const today = Math.floor(now / DAY) * DAY;
  return Array.from({ length: 14 }, (_, i) => {
    const end = today - (13 - i) * DAY + DAY;
    const win = tickets.filter((t) => t.createdAt < end && t.createdAt >= end - 7 * DAY);
    if (!win.length) return 90;
    const late = win.filter((t) => (t.firstResponseAt ?? Math.min(end, now)) > t.slaDueAt).length;
    return Math.round(96 - (30 * late) / win.length);
  });
}

function kpis(r: SupportRows, csat: number[], now: number): Kpi[] {
  const open = r.tickets.filter((t) => t.status === "open");
  const risk = open.filter((t) => ["breached", "risk"].includes(slaState(t, now).kind)).length;
  const first = median(r.tickets.flatMap((t) => (t.firstResponseAt === null ? [] : [(t.firstResponseAt - t.createdAt) / 3600])));
  const v1 = open.filter((t) => t.v1Related).length;
  const weak = r.customers.filter((c) => c.healthScore < 50).length;
  const score = csat[csat.length - 1] ?? 0;
  return [
    kpi("open-tickets", "Open tickets", open.length, "count"),
    kpi("sla-risk", "SLA at risk", risk, "count", risk > 0 ? "bad" : "ok"),
    kpi("first-response", "Median first response", first, "hours", first > 1 ? "warn" : "ok"),
    kpi("csat", "CSAT", score, "percent", score < 85 ? "warn" : "ok"),
    kpi("v1-tickets", "Open tickets about API v1", v1, "count", v1 > 0 ? "warn" : "ok"),
    kpi("weak-health", "Customers with health below 50", weak, "count", weak > 0 ? "warn" : "ok"),
  ];
}

export function buildSupport(r: SupportRows, angle: RippleAngle, now: number): SupportPayload {
  const csat = csatSeries(r.tickets, now);
  return { team: "support", kpis: kpis(r, csat, now), angle, now, ...r, csat };
}
