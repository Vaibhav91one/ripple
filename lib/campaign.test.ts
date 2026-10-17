// Campaign tab data: real ledger states (sent, delivered, clicked, acked, reminded) from Postgres rows, plus Slack
// evidence, the change channel, tasks and access requests, folded per team. Needs FalkorDB and Postgres; skips without.
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { foldTeam } from "./campaign";
import type { LedgerEntry } from "./notify/ledger";

vi.mock("server-only", () => ({}));
const url = process.env.DATABASE_URL;
const at = (s: number) => new Date(s * 1000);

const entry = (o: Partial<LedgerEntry>): LedgerEntry => ({
  teamId: "t", personId: "p", sentAt: null, deliveredAt: null, clickedAt: null, ackedAt: null,
  reminded: { "48h": null, "96h": null }, channels: [], discussed: [], ...o,
});

describe("foldTeam", () => {
  it("takes the earliest time per stage over the team's people and ignores other teams", () => {
    const rows = [
      entry({ personId: "a", sentAt: at(200), deliveredAt: at(210), clickedAt: at(400) }),
      entry({ personId: "b", sentAt: at(100), ackedAt: at(500), discussed: [{ channelId: "C1", permalink: "https://s/1", at: at(300), byPersonId: "b" }] }),
      entry({ personId: "c", teamId: "other", sentAt: at(1) }),
    ];
    expect(foldTeam(rows, "t")).toEqual({
      told: 100, delivered: 210, clicked: 400, acked: 500,
      discussed: [{ at: 300, permalink: "https://s/1", channelId: "C1" }],
    });
    expect(foldTeam([], "t")).toMatchObject({ told: null, delivered: null, clicked: null, acked: null, discussed: [] });
  });
});

describe.skipIf(!url)("computeCampaign (Postgres + FalkorDB)", () => {
  const org = `test-camp-${randomUUID()}`;
  const graphName = `test_camp_${randomUUID().replaceAll("-", "")}`;
  let up = false;

  beforeAll(async () => {
    try {
      const { graphFor, query } = await import("./graph/client");
      const g = await graphFor(graphName);
      await query(g, "RETURN 1");
      const { seed } = await import("./ingest/seed");
      await seed(graphName);
      up = true;
    } catch (e) {
      console.warn(`SKIPPING computeCampaign: ${String(e)}`);
    }
  }, 60_000);

  afterAll(async () => {
    const { closeClient, graphFor } = await import("./graph/client");
    if (up) await (await graphFor(graphName)).delete();
    await closeClient();
    const { db } = await import("./db");
    const s = await import("./db/schema");
    const { eq } = await import("drizzle-orm");
    await db().delete(s.notifications).where(eq(s.notifications.orgId, org));
    await db().delete(s.evidence).where(eq(s.evidence.orgId, org));
    await db().delete(s.pendingActions).where(eq(s.pendingActions.orgId, org));
    await db().delete(s.orgs).where(eq(s.orgs.id, org)); // change_channel cascades
  });

  it("shows the ledger of d-1 per team: stages, discussed, channel, access", async (c) => {
    if (!up) c.skip();
    const { graphFor, query } = await import("./graph/client");
    const g = await graphFor(graphName);
    const { computeCampaign } = await import("./campaign");
    const { db } = await import("./db");
    const s = await import("./db/schema");
    const ctx = { graph: g, now: Math.floor(Date.parse("2026-10-17T09:00:00Z") / 1000), org: { id: org } } as unknown as Parameters<typeof computeCampaign>[0];

    const before = await computeCampaign(ctx, "d-1");
    expect(before.teams.length).toBeGreaterThan(1);
    expect(before.teams.every((t) => t.told === null && t.discussed.length === 0)).toBe(true);
    expect(before.channel).toBeNull();

    // someone on the first team: sent, delivered, clicked, acked; a Slack message by their team; a change channel; an access request
    const team = before.teams[0].teamId;
    const [{ id: person }] = await query<{ id: string }>(g, "MATCH (p:Person {teamId: $t}) RETURN p.id AS id ORDER BY p.id LIMIT 1", { t: team });
    const [n] = await db().insert(s.notifications).values({
      orgId: org, personId: person, kind: "change.announced", title: "d-1", body: { reason: "affected", subject: { kind: "change", id: "d-1" } },
      urgency: "normal", batchKey: randomUUID(), dedupeKey: randomUUID(),
    }).returning();
    await db().insert(s.deliveries).values({ notificationId: n.id, channel: "email", status: "sent", sentAt: at(1000), deliveredAt: at(1060), clickedAt: at(2000), ackedAt: at(3000) });
    await db().insert(s.evidence).values({ orgId: org, changeId: "d-1", teamId: team, channelId: "C-DISC", messageTs: "1.1", permalink: "https://acme.slack.com/archives/C-DISC/p11", personId: person });
    await db().insert(s.orgs).values({ id: org, slug: org, graphName, isDemo: false });
    await db().insert(s.changeChannels).values({ orgId: org, changeId: "d-1", slackTeamId: "T1", channelId: "C-CHG", name: "chg-d-1" });
    await db().insert(s.pendingActions).values({ orgId: org, kind: "access_request", payload: { decisionId: "d-1", teamId: team }, idempotencyKey: randomUUID() });

    const after = await computeCampaign(ctx, "d-1");
    expect(after.teams.find((t) => t.teamId === team)).toMatchObject({
      told: 1000, delivered: 1060, clicked: 2000, acked: 3000,
      discussed: [{ channelId: "C-DISC", permalink: "https://acme.slack.com/archives/C-DISC/p11" }],
      access: { pending: 1, total: 1 },
    });
    expect(after.teams.filter((t) => t.teamId !== team).every((t) => t.told === null)).toBe(true);
    expect(after.channel).toEqual({ id: "C-CHG", url: "https://slack.com/app_redirect?channel=C-CHG" });
  }, 30_000);
});
