import { describe, expect, it, vi } from "vitest";
import { RippleEvent } from "./types";

vi.mock("server-only", () => ({}));

const sample: Record<string, object> = {
  "change.spotted": { changeId: "c1" }, "change.confirmed": { changeId: "c1" }, "change.updated": { changeId: "c1" },
  "conflict.found": { changeId: "c1", conflictsWith: "c2" }, "brief.sent": { briefId: "b1", userId: "u1" },
  "ack.recorded": { changeId: "c1", userId: "u1" }, "ack.missing_48h": { changeId: "c1", userId: "u1" },
  "ack.missing_96h": { changeId: "c1", userId: "u1" }, "task.assigned": { taskId: "t1", userId: "u1" },
  "task.due": { taskId: "t1" }, "task.overdue": { taskId: "t1" }, "approval.requested": { changeId: "c1", approverId: "u1" },
  "access.needed": { userId: "u1", resource: "r" }, "access.granted": { userId: "u1", resource: "r" },
  "pr.opened": { url: "https://github.com/a/b/pull/1" }, "pr.updated": { url: "https://github.com/a/b/pull/1" },
  "digest.weekly": { weekStart: "2026-10-12" },
  "evidence.recorded": { changeId: "c1", channelId: "C1" },
  "slack.inbound": { kind: "event", teamId: "T1", body: { type: "message" } },
};
const make = (type: string, dedupeKey = type) =>
  ({ type, orgId: "o", subject: { kind: "change", id: "c1" }, payload: sample[type], dedupeKey }) as RippleEvent;

describe("event catalog", () => {
  it("parses every type with a sample payload", () => {
    expect(Object.keys(sample)).toHaveLength(RippleEvent.options.length);
    for (const type of Object.keys(sample)) expect(RippleEvent.safeParse(make(type)).success, type).toBe(true);
  });
  it("rejects a bad payload", () => {
    expect(RippleEvent.safeParse({ ...make("task.due"), payload: {} }).success).toBe(false);
  });
});

const url = process.env.DATABASE_URL;

describe("emit()", () => {
  it("is a no-op without DATABASE_URL", async () => {
    vi.stubEnv("DATABASE_URL", "");
    const { emit } = await import("./emit");
    expect(await emit({} as never, make("task.due"))).toEqual({ inserted: false });
    vi.unstubAllEnvs();
  });

  it.skipIf(!url)("inserts a duplicate dedupe_key once", async () => {
    const { emit } = await import("./emit");
    const { db } = await import("../db");
    const { events } = await import("../db/schema");
    const { eq } = await import("drizzle-orm");
    const key = `test-${crypto.randomUUID()}`;
    const a = await emit(db(), make("task.due", key));
    const b = await emit(db(), make("task.due", key));
    expect(a.inserted).toBe(true);
    expect(b).toEqual({ inserted: false });
    expect(await db().select().from(events).where(eq(events.dedupeKey, key))).toHaveLength(1);
    await db().delete(events).where(eq(events.dedupeKey, key));
  });
});
