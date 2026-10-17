// Per team and person view of one change: what was sent, delivered, clicked, acked and reminded, with timestamps.
// Only provider facts are shown: Slack reports "sent", never "read", so a null stays null.
import "server-only";
import { eq, inArray } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import * as schema from "../db/schema";

export type LedgerEntry = {
  teamId: string | null;
  personId: string;
  sentAt: Date | null;
  deliveredAt: Date | null;
  clickedAt: Date | null;
  ackedAt: Date | null;
  /** When the 48h / 96h reminders were stored for this person. */
  reminded: { "48h": Date | null; "96h": Date | null };
  channels: { channel: string; status: string; error: string | null }[];
};

const first = (xs: (Date | null)[]) => xs.filter((x): x is Date => !!x).sort((a, b) => +a - +b)[0] ?? null;

export async function ledgerFor(
  d: PostgresJsDatabase<typeof schema>, orgId: string, changeId: string, teamOf: (personId: string) => string | null = () => null,
): Promise<LedgerEntry[]> {
  const { notifications: n, deliveries } = schema;
  const rows = (await d.select().from(n).where(eq(n.orgId, orgId))).filter((r) => r.body.subject.id === changeId);
  const sends = rows.length ? await d.select().from(deliveries).where(inArray(deliveries.notificationId, rows.map((r) => r.id))) : [];
  const out = new Map<string, LedgerEntry>();
  for (const r of rows) {
    const e = out.get(r.personId) ?? {
      teamId: teamOf(r.personId), personId: r.personId, sentAt: null, deliveredAt: null, clickedAt: null, ackedAt: null,
      reminded: { "48h": null, "96h": null }, channels: [],
    };
    out.set(r.personId, e);
    const m = /^ack_reminder:(48h|96h)$/.exec(r.body.reason);
    if (m) e.reminded[m[1] as "48h" | "96h"] = r.createdAt;
  }
  for (const s of sends) {
    const e = out.get(rows.find((r) => r.id === s.notificationId)!.personId)!;
    e.sentAt = first([e.sentAt, s.sentAt]);
    e.deliveredAt = first([e.deliveredAt, s.deliveredAt]);
    e.clickedAt = first([e.clickedAt, s.clickedAt]);
    e.ackedAt = first([e.ackedAt, s.ackedAt]);
    e.channels.push({ channel: s.channel, status: s.status, error: s.error });
  }
  return [...out.values()].sort((a, b) => (a.teamId ?? "").localeCompare(b.teamId ?? "") || a.personId.localeCompare(b.personId));
}
