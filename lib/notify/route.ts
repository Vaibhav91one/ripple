// Pure: decides who hears about an event, on which channel, when. No I/O; all reads go through the injected readers.
import type { RippleEvent } from "@/lib/events/types";
import type { Channel, GraphReader, NotificationPlan, Prefs, PrefsReader, Urgency } from "./types";

type Hit = { personId: string; reason: string; urgency: Urgency; email?: boolean };
const RANK: Record<Urgency, number> = { low: 0, normal: 1, high: 2 };
const BATCH_SECONDS = 15 * 60;

const hits = (ids: (string | null)[], reason: string, urgency: Urgency, email?: boolean): Hit[] =>
  ids.filter((id): id is string => !!id).map((personId) => ({ personId, reason, urgency, email }));

/** Who should hear about this event, highest priority first. */
function recipients(e: RippleEvent, g: GraphReader): Hit[] {
  switch (e.type) {
    case "change.spotted":
      return []; // unconfirmed; nobody is messaged until it is confirmed
    case "change.confirmed":
      return [...hits(g.teamOwners(e.payload.changeId), "team_owner", "normal"), ...hits(g.systemOwners(e.payload.changeId), "system_owner", "normal")];
    case "change.updated":
      return [
        ...hits(g.teamOwners(e.payload.changeId), "team_owner", "normal"),
        ...hits(g.systemOwners(e.payload.changeId), "system_owner", "normal"),
        ...hits(g.acknowledgers(e.payload.changeId), "acknowledged_earlier", "normal"),
      ];
    case "conflict.found":
      return [...hits([g.changeOwner(e.payload.changeId)], "change_owner", "high"), ...hits([g.changeOwner(e.payload.conflictsWith)], "conflicting_change_owner", "high")];
    case "brief.sent":
      return hits([e.payload.userId], "brief_recipient", "normal", true);
    case "ack.recorded":
      return hits([g.changeOwner(e.payload.changeId)], "change_owner", "low");
    case "ack.missing_48h":
      return hits([e.payload.userId], "ack_reminder:48h", "normal");
    case "ack.missing_96h": {
      // Escalate to the lead, CC the change owner (inbox only); if the person has none (or is the lead), fall back to the change owner.
      const lead = g.teamLead(e.payload.userId) ?? g.changeOwner(e.payload.changeId);
      return [...hits([lead], "escalation:96h", "high"), ...hits([e.payload.userId], "ack_reminder:96h", "high"), ...hits([g.changeOwner(e.payload.changeId)], "escalation_cc:96h", "low")];
    }
    case "task.assigned":
      return hits([e.payload.userId], "assignee", "normal");
    case "task.due":
      return hits(g.taskAssignees(e.payload.taskId), "assignee", "normal");
    case "task.overdue":
      return hits(g.taskAssignees(e.payload.taskId), "assignee", "high");
    case "approval.requested":
      return hits([e.payload.approverId], "approver", "high");
    case "access.needed":
      return hits(g.resourceOwners(e.payload.resource), "resource_owner", "normal");
    case "access.granted":
      return hits([e.payload.userId], "access_requester", "normal");
    case "pr.opened":
      return hits(g.prOwners(e.payload.url), "pr_owner", "normal");
    case "pr.updated":
      return hits(g.prOwners(e.payload.url), "pr_owner", "low");
    case "digest.weekly":
      return hits(g.digestRecipients(e.orgId), "weekly_digest", "low", true); // the digest is the one low item that is emailed
  }
}

function channels(urgency: Urgency, prefs: Prefs | undefined, email?: boolean): Channel[] {
  const chosen = prefs?.channels?.[urgency];
  if (chosen) return chosen;
  if (urgency === "high") return ["slack_dm", "email", "inbox"];
  if (urgency === "low") return email ? ["email", "inbox"] : ["inbox"];
  if (email) return ["email", "inbox"];
  return [prefs?.preferTeamChannel ? "slack_channel" : "slack_dm", "inbox"];
}

const minutes = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

const fmt = new Map<string, Intl.DateTimeFormat>();
/** Wall-clock fields of an instant in tz. */
function wall(ms: number, tz: string) {
  let f = fmt.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric" });
    fmt.set(tz, f);
  }
  const o: Record<string, number> = {};
  for (const x of f.formatToParts(ms)) if (x.type !== "literal") o[x.type] = Number(x.value);
  return o;
}
const offset = (ms: number, tz: string) => {
  const w = wall(ms, tz);
  return Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute, w.second) - Math.floor(ms / 1000) * 1000;
};

/** Epoch ms of local wall time Y-M-D + mins in tz; the offset is taken at the target so DST shifts are honoured. */
function wallToInstant(y: number, mo: number, d: number, mins: number, tz: string) {
  const guess = Date.UTC(y, mo - 1, d, Math.floor(mins / 60), mins % 60);
  return guess - offset(guess - offset(guess, tz), tz);
}

/** `now` pushed to the end of the quiet window if inside it. Bad tz/time = no quiet hours. */
export function afterQuiet(now: number, q: NonNullable<Prefs["quietHours"]>): number {
  try {
    const start = minutes(q.start);
    const end = minutes(q.end);
    if (Number.isNaN(start) || Number.isNaN(end) || start === end) return now;
    const w = wall(now * 1000, q.tz);
    const cur = w.hour * 60 + w.minute;
    const inside = start < end ? cur >= start && cur < end : cur >= start || cur < end;
    if (!inside) return now;
    // Wrapping window and we are past `start`: the window ends tomorrow.
    const day = start > end && cur >= start ? 1 : 0;
    const base = new Date(Date.UTC(w.year, w.month - 1, w.day + day));
    return Math.floor(wallToInstant(base.getUTCFullYear(), base.getUTCMonth() + 1, base.getUTCDate(), end, q.tz) / 1000);
  } catch {
    return now;
  }
}

export function route(event: RippleEvent, graph: GraphReader, prefs: PrefsReader, now: number): NotificationPlan[] {
  // One plan per person per event: keep the first reason, the highest urgency.
  const byPerson = new Map<string, Hit>();
  for (const h of recipients(event, graph)) {
    const prev = byPerson.get(h.personId);
    if (!prev) byPerson.set(h.personId, h);
    else if (RANK[h.urgency] > RANK[prev.urgency]) byPerson.set(h.personId, { ...prev, urgency: h.urgency });
  }
  const revision = graph.revision(event.subject);
  const wanted = [...byPerson.values()].filter((h) => !(event.type === "digest.weekly" && prefs.get(h.personId)?.digest === false));
  return wanted.map((h) => {
    const pf = prefs.get(h.personId);
    const sendAt = h.urgency === "high" || !pf?.quietHours ? now : afterQuiet(now, pf.quietHours);
    const dedupeKey = `${event.type}:${event.subject.id}:${h.personId}:${revision}`;
    return {
      personId: h.personId,
      reason: h.reason,
      urgency: h.urgency,
      channels: channels(h.urgency, pf, h.email),
      batchKey: h.urgency === "high" ? dedupeKey : `${h.personId}:${Math.floor(sendAt / BATCH_SECONDS)}`,
      dedupeKey,
      sendAt,
    };
  });
}
