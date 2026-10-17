// Server side of GET /api/changes/[id]/campaign: per affected team, how far the change has travelled (ledger, #162),
// whether people talked about it (Slack evidence, #194), its tasks and access requests. Postgres is optional:
// without DATABASE_URL (the shared demo) the ledger stages stay null and only the graph's view remains.
import { roQuery } from "./graph/client";
import { ripple } from "./graph/queries";
import { env } from "./env";
import type { Campaign, CampaignTeam } from "./schemas";
import type { Context } from "./server/context";
import type { LedgerEntry } from "./notify/ledger";

const sec = (d: Date | null) => (d ? Math.floor(+d / 1000) : null);
const earliest = (xs: (number | null)[]) => xs.filter((x): x is number => x !== null).sort((a, b) => a - b)[0] ?? null;
const LEAD = /lead|manager|head|director|counsel|chief|cto|coo|ceo/i; // same rule as create-tasks.cypher

/** One team's row: the earliest time any of its people reached each stage. Pure, so the Postgres test can pin it. */
export function foldTeam(ledger: LedgerEntry[], teamId: string): Pick<CampaignTeam, "told" | "delivered" | "clicked" | "acked" | "discussed"> {
  const mine = ledger.filter((e) => e.teamId === teamId);
  const pick = (k: "sentAt" | "deliveredAt" | "clickedAt" | "ackedAt") => earliest(mine.map((e) => sec(e[k])));
  const seen = new Map(mine.flatMap((e) => e.discussed).map((d) => [`${d.channelId}|${+d.at}`, { at: sec(d.at)!, permalink: d.permalink, channelId: d.channelId }]));
  return { told: pick("sentAt"), delivered: pick("deliveredAt"), clicked: pick("clickedAt"), acked: pick("ackedAt"), discussed: [...seen.values()].sort((a, b) => a.at - b.at) };
}

export async function computeCampaign(ctx: Context, changeId: string): Promise<Campaign> {
  const { graph: g, now, org } = ctx;
  const r = await ripple(g, changeId, now); // NotFound -> 404
  const [people, taskRows, sunset, meta] = await Promise.all([
    roQuery<{ id: string; title: string | null; teamId: string | null }>(g, "MATCH (p:Person) RETURN p.id AS id, p.title AS title, p.teamId AS teamId ORDER BY p.id"),
    roQuery<{ id: string; title: string; status: string; dueAt: number | null; teamId: string }>(g,
      "MATCH (k:Task) WHERE k.id STARTS WITH $prefix RETURN k.id AS id, k.title AS title, k.status AS status, k.dueAt AS dueAt, k.teamId AS teamId ORDER BY k.id", { prefix: `task-${changeId}-` }),
    roQuery<{ on: number }>(g, "MATCH (:Decision {id: $id})-[s:SUNSETS]->(:System) WHERE s.valid_to IS NULL RETURN s.on AS on LIMIT 1", { id: changeId }),
    // owner: the change's own, else the author of the document the sunset cites (seeded decisions have no owner property)
    roQuery<{ kind: string | null; owner: string | null; at: number | null }>(g,
      `MATCH (c:Change {id: $id}) OPTIONAL MATCH (c)-[s:SUNSETS]->(:System) WHERE s.valid_to IS NULL OPTIONAL MATCH (a:Artifact {id: s.src}) OPTIONAL MATCH (p:Person {id: a.author})
       WITH c, head(collect(DISTINCT p.id)) AS au RETURN c.kind AS kind, coalesce(c.owner, au) AS owner, c.effective_at AS at`, { id: changeId }),
  ]);
  const teamOf = new Map(people.map((p) => [p.id, p.teamId]));

  let ledger: LedgerEntry[] = [];
  let channel: Campaign["channel"] = null;
  const access = new Map<string, { pending: number; total: number }>();
  if (env().DATABASE_URL) {
    const [{ db }, { ledgerFor }, { channelForChange }, { pendingActions }, { and, eq }] = await Promise.all([
      import("./db"), import("./notify/ledger"), import("./connectors/slack/store"), import("./db/schema"), import("drizzle-orm"),
    ]);
    ledger = await ledgerFor(db(), org.id, changeId, (p) => teamOf.get(p) ?? null);
    const c = await channelForChange(org.id, changeId);
    channel = c ? { id: c, url: `https://slack.com/app_redirect?channel=${encodeURIComponent(c)}` } : null;
    const rows = await db().select().from(pendingActions).where(and(eq(pendingActions.orgId, org.id), eq(pendingActions.kind, "access_request")));
    for (const a of rows) {
      const p = a.payload as { decisionId?: string; teamId?: string };
      if (p.decisionId !== changeId || !p.teamId) continue;
      const x = access.get(p.teamId) ?? { pending: 0, total: 0 };
      x.total++;
      if (a.status === "pending") x.pending++;
      access.set(p.teamId, x);
    }
  }

  const effectiveAt = sunset[0]?.on ?? meta[0]?.at ?? null;
  const teams: CampaignTeam[] = r.teams.map((t) => {
    const tasks = taskRows.filter((k) => k.teamId === t.teamId).map(({ id, title, status, dueAt }) => ({ id, title, status, dueAt }));
    const owner = people.filter((p) => p.teamId === t.teamId).sort((a, b) => Number(LEAD.test(b.title ?? "")) - Number(LEAD.test(a.title ?? "")))[0];
    return {
      teamId: t.teamId, ownerId: owner?.id ?? null,
      dueAt: tasks.map((k) => k.dueAt).find((d) => d !== null) ?? (effectiveAt ? effectiveAt - 14 * 86400 : null),
      covered: !r.gap.includes(t.teamId),
      ...foldTeam(ledger, t.teamId), tasks, access: access.get(t.teamId) ?? { pending: 0, total: 0 },
    };
  });
  return { changeId, title: r.decision.title, kind: meta[0]?.kind ?? "decision", status: r.decision.status, owner: meta[0]?.owner ?? null, effectiveAt, channel, teams };
}

