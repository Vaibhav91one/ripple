// Contracts for GET /api/reports, /api/reports/[id] and /api/activity (#232). A "report" is the case file of one change:
// everything done for it, merged from the graph and the event log. Fixtures: lib/schemas/fixtures/reports.json.
// Free text never names restricted things (contracts, deals, customers): UI sentences are built from the typed
// `contracts` rows, which redaction drops for viewers who do not own them.
import { z } from "zod";
import { id, restrictedField, ts } from "./common";

/** blocked = an open contract conflict; waiting = teams not told yet; done = every affected team told, no conflict. */
export const ReportState = z.enum(["blocked", "waiting", "done"]);
export const Coverage = z.object({ told: z.number().int(), affected: z.number().int(), pct: z.number().int().min(0).max(100) });
export const MainGap = z.object({ teamId: id, name: z.string(), reason: z.string() });

export const ReportRow = z.object({
  id, // the change (decision) id
  title: z.string(),
  kind: z.literal("change"),
  state: ReportState,
  needsYou: z.boolean(),
  systems: z.array(z.object({ id, name: z.string() })),
  announcedAt: ts,
  effectiveAt: ts.nullable(),
  /** null = customer ARR is restricted (Sales and leadership see it) */
  arrAtRisk: z.number().int().nullable(),
  coverage: Coverage,
  mainGap: MainGap.nullable(),
  openConflicts: z.number().int(),
});
export const ReportList = z.object({
  now: ts,
  summary: z.object({ total: z.number().int(), needYou: z.number().int(), byState: z.record(ReportState, z.number().int()) }),
  cases: z.array(ReportRow),
  ...restrictedField,
});

export const Actor = z.object({ type: z.enum(["person", "agent", "system"]), id: z.string().nullable(), name: z.string() });
export const TimelineKind = z.enum(["announced", "traversed", "proposed", "approved", "rejected", "notified", "delivered", "ack", "issue", "conflict", "audit", "run"]);
/** where the row was read from; `demo` rows are seeded history and also carry demo: true */
export const TimelineSource = z.enum(["graph", "events", "audit_log", "pending_actions", "deliveries", "agent_runs", "demo"]);
export const TimelineEvent = z.object({
  id,
  at: ts,
  kind: TimelineKind,
  actor: Actor,
  teamId: id.nullable(),
  text: z.string(),
  /** e.g. the GitHub issue an executed create_issue action opened */
  url: z.string().nullable().default(null),
  source: TimelineSource,
  demo: z.boolean(),
});

export const TeamProgress = z.object({
  teamId: id,
  name: z.string(),
  expected: z.string(), // what this team is expected to do
  status: z.enum(["acked", "told", "not_told"]),
  doneAt: ts.nullable(),
  /** the sentence explaining why the team is affected */
  why: z.string(),
});
export const CaseConflict = z.object({
  id,
  severity: z.enum(["low", "medium", "high"]),
  status: z.enum(["open", "resolved"]),
  detectedAt: ts,
  /** contracts that guarantee the sunset system past the sunset date; redacted for non-owners */
  contracts: z.array(z.object({ id, name: z.string(), guaranteedUntil: ts.nullable(), arr: z.number().int().nullable() })),
  sources: z.array(z.object({ artifactId: z.string().nullable(), quote: z.string().nullable() })),
});
export const ReportDetail = z.object({
  now: ts,
  report: ReportRow,
  announcedBy: Actor.nullable(),
  /** where the announcement came from, e.g. an RFC */
  sourceRef: z.object({ artifactId: z.string(), quote: z.string() }).nullable(),
  counts: z.object({ teams: z.number().int(), customers: z.number().int(), tickets: z.number().int(), deals: z.number().int(), contracts: z.number().int() }),
  teams: z.array(TeamProgress),
  timeline: z.array(TimelineEvent),
  conflicts: z.array(CaseConflict),
  /** the numbers of the outcome so far; arrAtRisk null when restricted */
  result: z.object({
    arrAtRisk: z.number().int().nullable(),
    teamsTold: z.number().int(),
    teamsAcked: z.number().int(),
    openGaps: z.number().int(),
    openConflicts: z.number().int(),
    /** executed customer email / talk-track actions for this change (one per customer); not delivery receipts */
    noticesSent: z.number().int(),
    /** seeded demo history (no Postgres, or the demo org) instead of executed actions */
    noticesSentDemo: z.boolean(),
  }),
  ...restrictedField,
});

export const ActivityItem = TimelineEvent.extend({ caseId: id, caseTitle: z.string() });
export const Activity = z.object({
  now: ts,
  actor: z.enum(["all", "person", "agent", "system"]),
  items: z.array(ActivityItem),
  ...restrictedField,
});

export type ReportRow = z.infer<typeof ReportRow>;
export type ReportList = z.infer<typeof ReportList>;
export type ReportDetail = z.infer<typeof ReportDetail>;
export type TimelineEvent = z.infer<typeof TimelineEvent>;
export type TeamProgress = z.infer<typeof TeamProgress>;
export type Activity = z.infer<typeof Activity>;
export type ActivityItem = z.infer<typeof ActivityItem>;
