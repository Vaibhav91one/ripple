import { afterAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

// Runs where Postgres exists (CI sets DATABASE_URL); skips locally without one.
describe.skipIf(!process.env.DATABASE_URL)("conversation store + usage counters (postgres)", () => {
  const org = `chat-test-${crypto.randomUUID()}`;
  const me = { orgId: org, userId: "u1" };

  afterAll(async () => {
    const { db } = await import("../db");
    const { orgs, usageCounters } = await import("../db/schema");
    const { eq, like } = await import("drizzle-orm");
    await db().delete(orgs).where(eq(orgs.id, org)); // cascades conversations + messages
    await db().delete(usageCounters).where(like(usageCounters.key, `%${org}%`));
  });

  it("creates the org row, persists a thread and replays it", async () => {
    const store = await import("./store");
    const c = await store.createConversation(me, "Who owns auth?", "ask");
    expect(await store.addMessage(me, c.id, { role: "user", content: "Who owns auth?" })).toBe(true);
    expect(await store.addMessage(me, c.id, { role: "assistant", content: "Priya.", events: [{ type: "done" }] })).toBe(true);
    const got = await store.getConversation(me, c.id);
    expect(got?.messages.map((m) => m.role)).toEqual(["user", "assistant"]);
    expect((await store.listConversations(me)).map((x) => x.id)).toContain(c.id);
    expect((await store.renameConversation(me, c.id, "Auth owner"))?.title).toBe("Auth owner");
  });

  it("never shows or touches another user's thread", async () => {
    const store = await import("./store");
    const c = await store.createConversation(me, "mine");
    const other = { orgId: org, userId: "u2" };
    expect(await store.getConversation(other, c.id)).toBeNull();
    expect(await store.addMessage(other, c.id, { role: "user", content: "x" })).toBe(false);
    expect(await store.deleteConversation(other, c.id)).toBe(false);
    expect(await store.deleteConversation(me, c.id)).toBe(true);
  });

  it("takes quota atomically and stops at the limit", async () => {
    vi.stubEnv("DEMO_PROMPTS_PER_DAY", "3");
    const { visitorQuota } = await import("../agent/limits");
    const v = { cookie: org, ip: null };
    const results = await Promise.all(Array.from({ length: 6 }, () => visitorQuota(v, true)));
    expect(results.filter((r) => r.ok)).toHaveLength(3);
    expect((await visitorQuota(v, false)).ok).toBe(false);
    vi.unstubAllEnvs();
  });
});
