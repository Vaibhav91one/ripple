import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { RippleEvent } from "@/lib/events/types";
import { route } from "./route";
import type { GraphReader, Prefs, PrefsReader } from "./types";

// ---- fixtures: Ledgerly demo shapes (people with titles, teams, system on-call) ----
type P = { id: string; title: string; teamId: string };
const people: P[] = [
  { id: "p-priya", title: "Staff Engineer", teamId: "eng" },
  { id: "p-kenji", title: "Senior Engineer", teamId: "eng" },
  { id: "p-lena", title: "Platform Engineer", teamId: "eng" },
  { id: "p-ravi", title: "Engineering Manager", teamId: "eng" },
  { id: "p-ana", title: "Support Lead", teamId: "support" },
  { id: "p-tomas", title: "Support Engineer", teamId: "support" },
  { id: "p-nia", title: "Support Specialist", teamId: "support" },
  { id: "p-dee", title: "Sales Director", teamId: "sales" },
  { id: "p-bea", title: "Account Executive", teamId: "sales" },
  { id: "p-mei", title: "General Counsel", teamId: "legal" },
  { id: "p-noah", title: "Contracts Counsel", teamId: "legal" },
  { id: "p-zoe", title: "GRC Lead", teamId: "security" },
  { id: "p-sam", title: "Security Engineer", teamId: "security" },
  { id: "p-vera", title: "CEO", teamId: "leadership" }, // no lead title on her team
];
const LEAD = /Lead|Manager|Director|General Counsel/;
const leadOf = (teamId: string) => people.find((p) => p.teamId === teamId && LEAD.test(p.title))?.id ?? null;

const changes: Record<string, { owner: string; gapTeams: string[]; systems: string[]; acked: string[]; rev?: string }> = {
  c1: { owner: "p-priya", gapTeams: ["support", "sales", "legal"], systems: ["api-v1"], acked: ["p-sam"] }, // API v1 sunset
  c2: { owner: "p-kenji", gapTeams: ["sales"], systems: ["api-v2"], acked: [] },
  c3: { owner: "p-priya", gapTeams: [], systems: [], acked: [], rev: "3" },
};
const onCall: Record<string, string> = { "api-v1": "p-priya", "api-v2": "p-kenji", "auth-service": "p-lena" };

const graph: GraphReader = {
  changeOwner: (id) => changes[id]?.owner ?? null,
  teamOwners: (id) => (changes[id]?.gapTeams ?? []).map(leadOf).filter((x): x is string => !!x),
  systemOwners: (id) => (changes[id]?.systems ?? []).map((s) => onCall[s]).filter(Boolean),
  acknowledgers: (id) => changes[id]?.acked ?? [],
  taskAssignees: (id) => ({ t1: ["p-tomas", "p-nia"], t2: ["p-ana"], t3: [] })[id] ?? [],
  teamLead: (id) => {
    const p = people.find((x) => x.id === id);
    const lead = p && leadOf(p.teamId);
    return lead && lead !== id ? lead : null;
  },
  resourceOwners: (r) => (r === "auth-service" ? ["p-lena"] : []),
  prOwners: (url) => (url.includes("/ledgerly/api/") ? ["p-kenji", "p-lena"] : []),
  digestRecipients: () => ["p-priya", "p-ana", "p-vera"],
  revision: (s) => changes[s.id]?.rev ?? "0",
};

const IST = { start: "22:00", end: "08:00", tz: "Asia/Calcutta" };
const prefStore: Record<string, Prefs> = {};
const prefs: PrefsReader = { get: (id) => prefStore[id] };
const withPrefs = (p: Record<string, Prefs>) => ({ get: (id: string) => p[id] }) as PrefsReader;

const NOW = Date.parse("2026-10-14T09:00:00Z") / 1000; // 14:30 IST, outside any quiet window
const ev = (type: string, payload: object, subject = { kind: "change", id: "c1" }) =>
  RippleEvent.parse({ type, orgId: "ledgerly", subject, payload, dedupeKey: `${type}:${subject.id}` });
const iso = (s: number) => new Date(s * 1000).toISOString().replace(".000Z", "Z");
const at = (s: string) => Date.parse(s) / 1000;

const DM = ["slack_dm", "inbox"];
const HIGH = ["slack_dm", "email", "inbox"];
const INBOX = ["inbox"];

// ---- every catalog event: recipients, urgency, channels ----
type Row = [name: string, event: RippleEvent, expected: [person: string, urgency: string, channels: string[], reason: string][]];
const table: Row[] = [
  ["change.spotted: nobody until confirmed", ev("change.spotted", { changeId: "c1" }), []],
  [
    "change.confirmed: gap-team leads by title, then system on-call",
    ev("change.confirmed", { changeId: "c1" }),
    [
      ["p-ana", "normal", DM, "team_owner"],
      ["p-dee", "normal", DM, "team_owner"],
      ["p-mei", "normal", DM, "team_owner"],
      ["p-priya", "normal", DM, "system_owner"],
    ],
  ],
  [
    "change.confirmed: lead and on-call are one person -> one plan",
    ev("change.confirmed", { changeId: "c2" }, { kind: "change", id: "c2" }),
    [
      ["p-dee", "normal", DM, "team_owner"],
      ["p-kenji", "normal", DM, "system_owner"],
    ],
  ],
  [
    "change.confirmed: no gaps, no systems -> nobody",
    ev("change.confirmed", { changeId: "c3" }, { kind: "change", id: "c3" }),
    [],
  ],
  [
    "change.updated: owners plus people who already acked",
    ev("change.updated", { changeId: "c1" }),
    [
      ["p-ana", "normal", DM, "team_owner"],
      ["p-dee", "normal", DM, "team_owner"],
      ["p-mei", "normal", DM, "team_owner"],
      ["p-priya", "normal", DM, "system_owner"],
      ["p-sam", "normal", DM, "acknowledged_earlier"],
    ],
  ],
  [
    "conflict.found: both change owners, high",
    ev("conflict.found", { changeId: "c1", conflictsWith: "c2" }),
    [
      ["p-priya", "high", HIGH, "change_owner"],
      ["p-kenji", "high", HIGH, "conflicting_change_owner"],
    ],
  ],
  [
    "conflict.found: same owner on both sides -> one plan",
    ev("conflict.found", { changeId: "c1", conflictsWith: "c3" }),
    [["p-priya", "high", HIGH, "change_owner"]],
  ],
  ["brief.sent: the recipient", ev("brief.sent", { briefId: "b1", userId: "p-tomas" }), [["p-tomas", "normal", DM, "brief_recipient"]]],
  ["ack.recorded: change owner, low, inbox only", ev("ack.recorded", { changeId: "c1", userId: "p-ana" }), [["p-priya", "low", INBOX, "change_owner"]]],
  ["ack.missing_48h: the person, normal", ev("ack.missing_48h", { changeId: "c1", userId: "p-tomas" }), [["p-tomas", "normal", DM, "ack_reminder:48h"]]],
  [
    "ack.missing_96h: escalates to the team lead, person also high",
    ev("ack.missing_96h", { changeId: "c1", userId: "p-tomas" }),
    [
      ["p-ana", "high", HIGH, "escalation:96h"],
      ["p-tomas", "high", HIGH, "ack_reminder:96h"],
      ["p-priya", "low", INBOX, "escalation_cc:96h"],
    ],
  ],
  [
    "ack.missing_96h: the lead is the one missing -> falls back to change owner",
    ev("ack.missing_96h", { changeId: "c1", userId: "p-ana" }),
    [
      ["p-priya", "high", HIGH, "escalation:96h"],
      ["p-ana", "high", HIGH, "ack_reminder:96h"],
    ],
  ],
  [
    "ack.missing_96h: person with no team lead -> change owner",
    ev("ack.missing_96h", { changeId: "c2", userId: "p-vera" }, { kind: "change", id: "c2" }),
    [
      ["p-kenji", "high", HIGH, "escalation:96h"],
      ["p-vera", "high", HIGH, "ack_reminder:96h"],
    ],
  ],
  ["task.assigned: the assignee", ev("task.assigned", { taskId: "t1", userId: "p-nia" }, { kind: "task", id: "t1" }), [["p-nia", "normal", DM, "assignee"]]],
  [
    "task.due: every assignee, normal",
    ev("task.due", { taskId: "t1" }, { kind: "task", id: "t1" }),
    [
      ["p-tomas", "normal", DM, "assignee"],
      ["p-nia", "normal", DM, "assignee"],
    ],
  ],
  ["task.due: unassigned task -> nobody", ev("task.due", { taskId: "t3" }, { kind: "task", id: "t3" }), []],
  [
    "task.overdue: every assignee, high",
    ev("task.overdue", { taskId: "t1" }, { kind: "task", id: "t1" }),
    [
      ["p-tomas", "high", HIGH, "assignee"],
      ["p-nia", "high", HIGH, "assignee"],
    ],
  ],
  ["approval.requested: the approver, high", ev("approval.requested", { changeId: "c1", approverId: "p-mei" }), [["p-mei", "high", HIGH, "approver"]]],
  ["access.needed: resource owner", ev("access.needed", { userId: "p-bea", resource: "auth-service" }, { kind: "user", id: "p-bea" }), [["p-lena", "normal", DM, "resource_owner"]]],
  ["access.needed: unknown resource -> nobody", ev("access.needed", { userId: "p-bea", resource: "nope" }, { kind: "user", id: "p-bea" }), []],
  ["access.granted: the requester", ev("access.granted", { userId: "p-bea", resource: "auth-service" }, { kind: "user", id: "p-bea" }), [["p-bea", "normal", DM, "access_requester"]]],
  [
    "pr.opened: repo owners, normal",
    ev("pr.opened", { url: "https://github.com/ledgerly/api/pull/7" }, { kind: "pr", id: "api#7" }),
    [
      ["p-kenji", "normal", DM, "pr_owner"],
      ["p-lena", "normal", DM, "pr_owner"],
    ],
  ],
  [
    "pr.updated: repo owners, low",
    ev("pr.updated", { url: "https://github.com/ledgerly/api/pull/7" }, { kind: "pr", id: "api#7" }),
    [
      ["p-kenji", "low", INBOX, "pr_owner"],
      ["p-lena", "low", INBOX, "pr_owner"],
    ],
  ],
  ["pr.opened: unknown repo -> nobody", ev("pr.opened", { url: "https://github.com/x/y/pull/1" }, { kind: "pr", id: "y#1" }), []],
  [
    "digest.weekly: everyone, low, emailed",
    ev("digest.weekly", { weekStart: "2026-10-12" }, { kind: "org", id: "ledgerly" }),
    [
      ["p-priya", "low", ["email", "inbox"], "weekly_digest"],
      ["p-ana", "low", ["email", "inbox"], "weekly_digest"],
      ["p-vera", "low", ["email", "inbox"], "weekly_digest"],
    ],
  ],
];

describe("route(): recipients, urgency, channels per catalog event", () => {
  it.each(table)("%s", (_name, event, expected) => {
    const plans = route(event, graph, prefs, NOW);
    expect(plans.map((p) => [p.personId, p.urgency, p.channels, p.reason])).toEqual(expected);
    for (const p of plans) expect(p.sendAt).toBe(NOW);
  });

  it("covers every event type in the catalog", () => {
    const covered = new Set(table.map(([, e]) => e.type));
    expect([...covered].sort()).toEqual(RippleEvent.options.map((o) => o.shape.type.value).sort());
  });

  it("is deterministic and does not mutate its input", () => {
    const e = ev("change.confirmed", { changeId: "c1" });
    const copy = structuredClone(e);
    expect(route(e, graph, prefs, NOW)).toEqual(route(e, graph, prefs, NOW));
    expect(e).toEqual(copy);
  });
});

describe("route(): escalation", () => {
  it("96h targets the team lead of the missing person, at high urgency, by DM + email", () => {
    const [lead] = route(ev("ack.missing_96h", { changeId: "c1", userId: "p-nia" }), graph, prefs, NOW);
    expect(lead).toMatchObject({ personId: "p-ana", reason: "escalation:96h", urgency: "high", channels: HIGH });
  });
  it("48h does not escalate", () => {
    const plans = route(ev("ack.missing_48h", { changeId: "c1", userId: "p-nia" }), graph, prefs, NOW);
    expect(plans.map((p) => p.personId)).toEqual(["p-nia"]);
  });
  it("finds the lead by title per team", () => {
    const lead = (userId: string) => route(ev("ack.missing_96h", { changeId: "c1", userId }), graph, prefs, NOW)[0].personId;
    expect([lead("p-kenji"), lead("p-bea"), lead("p-noah"), lead("p-sam")]).toEqual(["p-ravi", "p-dee", "p-mei", "p-zoe"]);
  });
});

describe("route(): channels and preferences", () => {
  const e = ev("task.assigned", { taskId: "t1", userId: "p-nia" }, { kind: "task", id: "t1" });
  it("normal goes to the team channel when preferred", () => {
    const [p] = route(e, graph, withPrefs({ "p-nia": { preferTeamChannel: true } }), NOW);
    expect(p.channels).toEqual(["slack_channel", "inbox"]);
  });
  it("high ignores the team-channel preference", () => {
    const [p] = route(ev("approval.requested", { changeId: "c1", approverId: "p-mei" }), graph, withPrefs({ "p-mei": { preferTeamChannel: true } }), NOW);
    expect(p.channels).toEqual(HIGH);
  });
  it("low is never a DM, even when a team channel is preferred", () => {
    const [p] = route(ev("ack.recorded", { changeId: "c1", userId: "p-ana" }), graph, withPrefs({ "p-priya": { preferTeamChannel: true } }), NOW);
    expect(p.channels).toEqual(INBOX);
  });
  it("every plan has an inbox copy", () => {
    for (const [, event] of table) for (const p of route(event, graph, prefs, NOW)) expect(p.channels).toContain("inbox");
  });
});

describe("route(): dedupe", () => {
  it("is type:subject:person:revision", () => {
    const plans = route(ev("change.updated", { changeId: "c3" }, { kind: "change", id: "c3" }), graph, prefs, NOW);
    expect(plans).toEqual([]); // c3 has no recipients; use c1 below
    const [p] = route(ev("ack.recorded", { changeId: "c1", userId: "p-ana" }), graph, prefs, NOW);
    expect(p.dedupeKey).toBe("ack.recorded:c1:p-priya:0");
  });
  it("uses the subject's revision so an update can notify again", () => {
    const rev = (id: string) => ({ ...graph, revision: () => id });
    const e = ev("change.confirmed", { changeId: "c2" }, { kind: "change", id: "c2" });
    const a = route(e, rev("1"), prefs, NOW)[0].dedupeKey;
    const b = route(e, rev("2"), prefs, NOW)[0].dedupeKey;
    expect(a).toBe("change.confirmed:c2:p-dee:1");
    expect(b).not.toBe(a);
  });
  it("is unique per person within one event", () => {
    const keys = route(ev("change.updated", { changeId: "c1" }), graph, prefs, NOW).map((p) => p.dedupeKey);
    expect(new Set(keys).size).toBe(keys.length);
  });
  it("collapses a person reached two ways into one plan with the higher urgency", () => {
    const g: GraphReader = { ...graph, teamOwners: () => ["p-ana"], systemOwners: () => [], acknowledgers: () => ["p-ana"] };
    const g2: GraphReader = { ...g, taskAssignees: () => ["p-ana", "p-ana"] };
    expect(route(ev("change.updated", { changeId: "c1" }), g, prefs, NOW)).toHaveLength(1);
    expect(route(ev("task.overdue", { taskId: "t2" }, { kind: "task", id: "t2" }), g2, prefs, NOW)).toHaveLength(1);
  });
  it("keeps the first reason and the highest urgency when roles overlap", () => {
    const g: GraphReader = { ...graph, changeOwner: (id) => (id === "c1" ? "p-priya" : "p-priya") };
    const plans = route(ev("ack.missing_96h", { changeId: "c1", userId: "p-priya" }), { ...g, teamLead: () => "p-priya" }, prefs, NOW);
    expect(plans).toHaveLength(1);
    expect(plans[0]).toMatchObject({ reason: "escalation:96h", urgency: "high" });
  });
});

describe("route(): batching", () => {
  const bucket = (s: number) => Math.floor(s / 900);
  const task = (id: string) => ev("task.assigned", { taskId: "t1", userId: "p-nia" }, { kind: "task", id });
  it("normal plans for one person within a 15-minute window share a batchKey", () => {
    const a = route(task("t1"), graph, prefs, at("2026-10-14T09:01:00Z"))[0];
    const b = route(ev("brief.sent", { briefId: "b", userId: "p-nia" }), graph, prefs, at("2026-10-14T09:14:59Z"))[0];
    expect(a.batchKey).toBe(b.batchKey);
    expect(a.batchKey).toBe(`p-nia:${bucket(at("2026-10-14T09:01:00Z"))}`);
  });
  it("normal and low plans for one person share a batchKey", () => {
    const normal = route(ev("brief.sent", { briefId: "b", userId: "p-priya" }), graph, prefs, NOW)[0];
    const low = route(ev("ack.recorded", { changeId: "c1", userId: "p-ana" }), graph, prefs, NOW)[0];
    expect(normal.personId).toBe(low.personId);
    expect(normal.batchKey).toBe(low.batchKey);
  });
  it("a new window gets a new batchKey", () => {
    const a = route(task("t1"), graph, prefs, at("2026-10-14T09:14:59Z"))[0];
    const b = route(task("t1"), graph, prefs, at("2026-10-14T09:15:00Z"))[0];
    expect(a.batchKey).not.toBe(b.batchKey);
  });
  it("different people never share a batchKey", () => {
    const keys = route(ev("task.due", { taskId: "t1" }, { kind: "task", id: "t1" }), graph, prefs, NOW).map((p) => p.batchKey);
    expect(new Set(keys).size).toBe(2);
  });
  it("high plans are never batched: their key is their dedupeKey", () => {
    for (const p of route(ev("task.overdue", { taskId: "t1" }, { kind: "task", id: "t1" }), graph, prefs, NOW)) expect(p.batchKey).toBe(p.dedupeKey);
  });
  it("plans deferred to the end of quiet hours batch together", () => {
    const quiet = withPrefs({ "p-nia": { quietHours: IST } });
    const a = route(task("t1"), graph, quiet, at("2026-10-14T17:30:00Z"))[0];
    const b = route(ev("brief.sent", { briefId: "b", userId: "p-nia" }), graph, quiet, at("2026-10-14T20:00:00Z"))[0];
    expect(a.sendAt).toBe(b.sendAt);
    expect(a.batchKey).toBe(b.batchKey);
  });
});

describe("route(): quiet hours", () => {
  const send = (now: string, quiet: Prefs["quietHours"], urgency: "normal" | "high" | "low" = "normal") => {
    const event = { normal: ev("brief.sent", { briefId: "b", userId: "p-nia" }), high: ev("approval.requested", { changeId: "c1", approverId: "p-nia" }), low: ev("ack.recorded", { changeId: "c1", userId: "p-ana" }) }[urgency];
    const who = urgency === "low" ? "p-priya" : "p-nia";
    return iso(route(event, graph, withPrefs({ [who]: { quietHours: quiet } }), at(now))[0].sendAt);
  };

  it.each([
    ["before the window: untouched", "2026-10-14T09:00:00Z", "2026-10-14T09:00:00Z"],
    ["one minute before start (21:59 IST)", "2026-10-14T16:29:00Z", "2026-10-14T16:29:00Z"],
    ["exactly at start (22:00 IST) is inside", "2026-10-14T16:30:00Z", "2026-10-15T02:30:00Z"],
    ["late evening (23:00 IST) defers to 08:00 IST next day", "2026-10-14T17:30:00Z", "2026-10-15T02:30:00Z"],
    ["after midnight (02:00 IST) defers to 08:00 IST same day", "2026-10-13T20:30:00Z", "2026-10-14T02:30:00Z"],
    ["one minute before end (07:59 IST)", "2026-10-14T02:29:00Z", "2026-10-14T02:30:00Z"],
    ["exactly at end (08:00 IST) is outside", "2026-10-14T02:30:00Z", "2026-10-14T02:30:00Z"],
    ["month rollover (31 Oct 23:00 IST)", "2026-10-31T17:30:00Z", "2026-11-01T02:30:00Z"],
    ["year rollover (31 Dec 23:00 IST)", "2026-12-31T17:30:00Z", "2027-01-01T02:30:00Z"],
  ])("IST 22:00-08:00, %s", (_n, now, expected) => {
    expect(send(now, IST)).toBe(expected);
  });

  it("applies to low as well as normal", () => {
    expect(send("2026-10-14T17:30:00Z", IST, "low")).toBe("2026-10-15T02:30:00Z");
  });
  it("never defers high urgency", () => {
    expect(send("2026-10-14T17:30:00Z", IST, "high")).toBe("2026-10-14T17:30:00Z");
  });
  it("same-day window (12:00-14:00, no wrap)", () => {
    const q = { start: "12:00", end: "14:00", tz: "Asia/Calcutta" };
    expect([send("2026-10-14T07:00:00Z", q), send("2026-10-14T05:00:00Z", q), send("2026-10-14T09:00:00Z", q)]).toEqual([
      "2026-10-14T08:30:00Z", // 12:30 IST -> 14:00 IST
      "2026-10-14T05:00:00Z", // 10:30 IST, before
      "2026-10-14T09:00:00Z", // 14:30 IST, after
    ]);
  });
  it("uses the person's timezone, not the server's", () => {
    const tokyo = { start: "22:00", end: "08:00", tz: "Asia/Tokyo" };
    // 23:00Z = 08:00 Tokyo next day = just outside; 22:59Z = 07:59 Tokyo = inside.
    expect(send("2026-10-14T23:00:00Z", tokyo)).toBe("2026-10-14T23:00:00Z");
    expect(send("2026-10-14T22:59:00Z", tokyo)).toBe("2026-10-14T23:00:00Z");
  });
  it("ignores an invalid timezone or malformed window rather than throwing", () => {
    const now = "2026-10-14T17:30:00Z";
    expect(send(now, { ...IST, tz: "Mars/Olympus" })).toBe(now);
    expect(send(now, { start: "late", end: "early", tz: "Asia/Calcutta" })).toBe(now);
    expect(send(now, { start: "22:00", end: "22:00", tz: "Asia/Calcutta" })).toBe(now);
  });

  describe("across DST boundaries (America/New_York)", () => {
    const NY = { start: "22:00", end: "08:00", tz: "America/New_York" };
    it("spring forward: Sat 23:00 EST -> Sun 08:00 EDT (12:00Z, not 13:00Z)", () => {
      expect(send("2026-03-08T04:00:00Z", NY)).toBe("2026-03-08T12:00:00Z");
    });
    it("spring forward: the night's 02:00 hour does not exist; a window ending 03:00 EDT", () => {
      // 01:30 EST = 06:30Z, window 01:00-03:00 ends at 03:00 EDT = 07:00Z.
      expect(send("2026-03-08T06:30:00Z", { start: "01:00", end: "03:00", tz: "America/New_York" })).toBe("2026-03-08T07:00:00Z");
    });
    it("spring forward: a window end that falls in the skipped hour lands on the real instant after it", () => {
      // 02:30 local does not exist on 8 Mar; it resolves to 03:30 EDT (07:30Z) or 01:30 EST, never earlier than the gap.
      const out = at(send("2026-03-08T06:10:00Z", { start: "01:00", end: "02:30", tz: "America/New_York" }));
      expect(out).toBeGreaterThanOrEqual(at("2026-03-08T06:30:00Z"));
      expect(out).toBeLessThanOrEqual(at("2026-03-08T07:30:00Z"));
    });
    it("fall back: Sat 23:00 EDT -> Sun 08:00 EST (13:00Z, not 12:00Z)", () => {
      expect(send("2026-11-01T03:00:00Z", NY)).toBe("2026-11-01T13:00:00Z");
    });
    it("fall back: 00:30 EDT with window to 02:00 ends at 02:00 EST (07:00Z), after the repeated hour", () => {
      expect(send("2026-11-01T04:30:00Z", { start: "00:00", end: "02:00", tz: "America/New_York" })).toBe("2026-11-01T07:00:00Z");
    });
    it("fall back: the repeated 01:30 EST (06:30Z) is still inside and ends at the same instant", () => {
      expect(send("2026-11-01T06:30:00Z", { start: "00:00", end: "02:00", tz: "America/New_York" })).toBe("2026-11-01T07:00:00Z");
    });
    it("the day after spring forward is a normal 24h-shifted offset", () => {
      expect(send("2026-03-09T03:00:00Z", NY)).toBe("2026-03-09T12:00:00Z"); // 23:00 EDT -> 08:00 EDT
    });
    it("Europe/London: BST ends 25 Oct 2026, 23:00 Sat BST -> 08:00 Sun GMT (08:00Z)", () => {
      expect(send("2026-10-24T22:00:00Z", { start: "22:00", end: "08:00", tz: "Europe/London" })).toBe("2026-10-25T08:00:00Z");
    });
  });
});

describe("route.ts is pure", () => {
  const src = readFileSync(new URL("./route.ts", import.meta.url), "utf8");
  it("imports nothing but types", () => {
    const imports = [...src.matchAll(/^import .*$/gm)].map((m) => m[0]);
    expect(imports.length).toBeGreaterThan(0);
    for (const line of imports) expect(line).toMatch(/^import type /);
  });
  it("touches no clock, randomness or I/O", () => {
    expect(src).not.toMatch(/Date\.now|new Date\(\)|Math\.random|fetch\(|process\.|require\(|await /);
  });
});
