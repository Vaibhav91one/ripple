// The Postgres loaders for the case file and agent stats, against a real database. Skips without DATABASE_URL (CI has one).
import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const url = process.env.DATABASE_URL;

describe.skipIf(!url)("loadRows / loadAgentGroups (Postgres)", () => {
  const org = `test-rep-${randomUUID()}`;
  afterAll(async () => {
    const { db } = await import("./db");
    const { eq } = await import("drizzle-orm");
    const s = await import("./db/schema");
    await db().delete(s.pendingActions).where(eq(s.pendingActions.orgId, org));
    await db().delete(s.events).where(eq(s.events.orgId, org));
  });

  it("filters one change in SQL, exactly, and counts approvals org-wide", async () => {
    const { db } = await import("./db");
    const s = await import("./db/schema");
    const { loadAgentGroups, loadRows, pendingEvents } = await import("./reports-db");
    const t = new Date("2026-10-01T10:00:00Z");
    const act = (kind: string, status: string, payload: unknown, extra: object = {}) =>
      ({ orgId: org, kind, status: status as "pending", payload, idempotencyKey: randomUUID(), requestedAt: t, ...extra });
    await db().insert(s.pendingActions).values([
      act("notice", "executed", { decisionId: "d-1" }, { approver: "p-ana", decidedAt: new Date(+t + 2 * 3.6e6) }),
      act("email", "rejected", { decisionId: "d-1" }, { approver: "p-ana", decidedAt: new Date(+t + 4 * 3.6e6) }),
      act("email", "pending", { decisionId: "d-10" }), // a different change whose id starts with d-1
      act("create_issue", "executed", { title: "Migrate off v1 (d-1)", body: "" }, { approver: "p-ana", decidedAt: t, result: { status: "created", url: "https://github.com/o/r/issues/7" } }),
    ]);
    await db().insert(s.events).values({ orgId: org, type: "campaign.chase", subjectKind: "change", subjectId: "d-1", payload: { changeId: "d-1" }, dedupeKey: randomUUID() });

    const rows = (await loadRows(org, "d-1"))!;
    expect(rows.pending.map((p) => p.kind).sort()).toEqual(["create_issue", "email", "notice"]);
    expect(rows.events).toHaveLength(1);
    const ev = pendingEvents(rows.pending, "d-1", (i) => i);
    expect(ev.find((e) => e.kind === "issue")?.url).toBe("https://github.com/o/r/issues/7");
    expect((await loadRows(org, "d-2"))!.pending).toEqual([]);

    const g = (await loadAgentGroups(org))!;
    expect(g.groups.reduce((n, x) => n + x.n, 0)).toBe(4);
    expect(g.medianHours).toBeGreaterThan(0);
  });
});

describe("without DATABASE_URL", () => {
  it("answers null so callers may show labelled demo history", async () => {
    const saved = process.env.DATABASE_URL;
    delete process.env.DATABASE_URL;
    try {
      const { loadAgentGroups, loadRows } = await import("./reports-db");
      expect(await loadRows("o", "d-1")).toBeNull();
      expect(await loadAgentGroups("o")).toBeNull();
    } finally {
      if (saved) process.env.DATABASE_URL = saved;
    }
  });
});
