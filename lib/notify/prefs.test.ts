// Merge order (person > org > system), the PrefsReader snapshot feeding route(), quiet hours across DST, and the Postgres round trip (skips without DATABASE_URL; CI sets it).
import { afterAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { digestDue, effective, merge, snapshotReader, SYSTEM_DEFAULTS, toPrefs } from "./prefs";
import { afterQuiet, route } from "./route";
import type { GraphReader } from "./types";

describe("merge order: person, then org, then system", () => {
  const org = { channels: { normal: ["email" as const, "inbox" as const] }, tz: "Asia/Calcutta", quietStart: "22:00", quietEnd: "08:00", digestDay: "fri" };
  const person = { channels: { normal: ["slack_dm" as const] }, tz: "America/New_York" };

  it("person wins over org and system", () => {
    const e = effective(person, org);
    expect(e.channels?.normal).toEqual(["slack_dm"]);
    expect(e.tz).toBe("America/New_York");
  });
  it("org fills what the person left unset, per field", () => {
    const e = effective(person, org);
    expect([e.quietStart, e.quietEnd, e.digestDay]).toEqual(["22:00", "08:00", "fri"]);
  });
  it("system fills what neither set", () => {
    const e = effective(person, org);
    expect(e.channels?.high).toEqual(SYSTEM_DEFAULTS.channels.high);
    expect(e.digest).toBe(true);
    expect(effective(null, null)).toEqual(merge(SYSTEM_DEFAULTS));
  });
  it("a person can switch off org quiet hours with start == end", () => {
    expect(toPrefs({ quietStart: "00:00", quietEnd: "00:00" }, org).quietHours).toEqual({ start: "00:00", end: "00:00", tz: "Asia/Calcutta" });
    expect(afterQuiet(1_700_000_000, { start: "00:00", end: "00:00", tz: "UTC" })).toBe(1_700_000_000);
  });
  it("toPrefs leaves system defaults to route(): nothing set means nothing returned", () => {
    expect(toPrefs(null, null)).toEqual({});
    expect(toPrefs({ digest: false }, { digestDay: "mon" }).digest).toBe(false);
    expect(toPrefs(null, { digestDay: "off" }).digest).toBe(false);
  });
});

describe("digestDue: the digest day, 08:00-08:59 in the person's own time zone", () => {
  const at = (iso: string) => Math.floor(Date.parse(iso) / 1000);
  const MON_0300Z = at("2026-10-12T03:00:00Z"); // Monday 08:30 in Kolkata, Sunday 23:00 in New York
  it("fires once per zone, in that zone's Monday 08:00 hour", () => {
    expect(digestDue(MON_0300Z, { tz: "Asia/Calcutta" })).toBe("2026-10-12");
    expect(digestDue(MON_0300Z, { tz: "America/New_York" })).toBeNull();
    expect(digestDue(at("2026-10-12T12:30:00Z"), { tz: "America/New_York" })).toBe("2026-10-12");
    expect(digestDue(at("2026-10-12T04:00:00Z"), { tz: "Asia/Calcutta" })).toBeNull(); // 09:30
    expect(digestDue(at("2026-10-13T03:00:00Z"), { tz: "Asia/Calcutta" })).toBeNull(); // Tuesday
  });
  it("no zone set = UTC", () => expect(digestDue(at("2026-10-12T08:05:00Z"))).toBe("2026-10-12"));
  it("digest off, by the person or the org, never fires; a person's yes beats the org's off", () => {
    expect(digestDue(MON_0300Z, { tz: "Asia/Calcutta", digest: false })).toBeNull();
    expect(digestDue(MON_0300Z, { tz: "Asia/Calcutta" }, { digestDay: "off" })).toBeNull();
    expect(digestDue(MON_0300Z, { tz: "Asia/Calcutta", digest: true }, { digestDay: "off" })).toBe("2026-10-12");
  });
  it("the org's digest day moves it", () => {
    expect(digestDue(at("2026-10-16T08:10:00Z"), null, { digestDay: "fri" })).toBe("2026-10-16");
    expect(digestDue(MON_0300Z, { tz: "Asia/Calcutta" }, { digestDay: "fri" })).toBeNull();
  });
  it("a bad zone is skipped, not thrown", () => expect(digestDue(MON_0300Z, { tz: "Not/AZone" })).toBeNull());
});

describe("snapshotReader feeds route()", () => {
  const g = (over: Partial<GraphReader> = {}): GraphReader => ({
    changeOwner: () => null, teamOwners: () => [], systemOwners: () => [], acknowledgers: () => [], taskAssignees: () => [], teamLead: () => null, teamLeadOf: () => null,
    resourceOwners: () => [], prOwners: () => [], digestRecipients: () => ["p1", "p2"], revision: () => "0", ...over,
  });
  const brief = { id: "e1", orgId: "o", type: "brief.sent", subject: { kind: "brief", id: "b" }, payload: { briefId: "b", userId: "p1" }, occurredAt: 0 } as never;
  const digest = { id: "e2", orgId: "o", type: "digest.weekly", subject: { kind: "org", id: "o" }, payload: {}, occurredAt: 0 } as never;
  const reader = snapshotReader([{ personId: "p1", channels: { normal: ["email"] } }, { personId: "p2", digest: false }], { digestDay: "mon" });

  it("person channel choice replaces route's default for that urgency", () => {
    expect(route(brief, g(), reader, 1000)[0].channels).toEqual(["email"]);
  });
  it("people who turned the digest off are skipped", () => {
    expect(route(digest, g(), reader, 1000).map((p) => p.personId)).toEqual(["p1"]);
  });
  it("unknown person gets route's defaults", () => {
    expect(reader.get("nobody")).toEqual({ digest: true }); // only the org digest day; no channel or quiet override
  });
});

describe("afterQuiet across a DST boundary (America/New_York)", () => {
  const q = { start: "22:00", end: "07:00", tz: "America/New_York" };
  const at = (iso: string) => Date.parse(iso) / 1000;
  const iso = (s: number) => new Date(s * 1000).toISOString();
  it("spring forward (2026-03-08): the night is an hour shorter, 07:00 is still 07:00 local (EDT)", () => {
    expect(iso(afterQuiet(at("2026-03-08T04:00:00Z"), q))).toBe("2026-03-08T11:00:00.000Z"); // 23:00 EST on the 7th -> 07:00 EDT
  });
  it("fall back (2026-11-01): the night is an hour longer, 07:00 is 07:00 local (EST)", () => {
    expect(iso(afterQuiet(at("2026-11-01T03:00:00Z"), q))).toBe("2026-11-01T12:00:00.000Z"); // 23:00 EDT on the 31st -> 07:00 EST
  });
  it("outside the window is untouched", () => {
    expect(afterQuiet(at("2026-11-01T18:00:00Z"), q)).toBe(at("2026-11-01T18:00:00Z"));
  });
});

const url = process.env.DATABASE_URL;
describe.skipIf(!url)("preferences in Postgres", () => {
  const org = `test-org-${crypto.randomUUID()}`;
  afterAll(async () => {
    const [{ db }, { orgs }, { eq }] = await Promise.all([import("../db"), import("../db/schema"), import("drizzle-orm")]);
    await db().delete(orgs).where(eq(orgs.id, org)); // cascades both pref tables
  });

  it("saves, upserts and reads back through loadPrefsReader and prefsFor", async () => {
    const [{ db }, { orgs }, p] = await Promise.all([import("../db"), import("../db/schema"), import("./prefs")]);
    await db().insert(orgs).values({ id: org, slug: org, graphName: `g_${org}` });
    await p.saveOrgDefault(org, { channels: { low: ["email"] }, tz: "Asia/Calcutta", quietStart: "22:00", quietEnd: "08:00", digestDay: "fri" });
    await p.savePersonPrefs(org, "u1", "p1", { channels: { normal: ["email"] }, digest: false });
    await p.savePersonPrefs(org, "u1", "p1", { channels: { normal: ["inbox"] }, digest: false }); // upsert
    const reader = await p.loadPrefsReader(org);
    expect(reader.get("p1")).toEqual({ channels: { normal: ["inbox"], low: ["email"] }, quietHours: { start: "22:00", end: "08:00", tz: "Asia/Calcutta" }, digest: false });
    expect(reader.get("p2")?.quietHours?.tz).toBe("Asia/Calcutta"); // someone with no row still gets the org default
    const e = await p.prefsFor(org, "p1");
    expect([e.channels?.high, e.digestDay]).toEqual([SYSTEM_DEFAULTS.channels.high, "fri"]);
  });
});
