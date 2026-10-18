// Formatting and state mapping for the Reports list and the case file (#233). Pure, so the copy rules are tested.
import type { StatusTone } from "@/components/ui/status-pill";
import type { ReportDetail, ReportRow, TeamProgress, TimelineEvent } from "@/lib/schemas/reports";

const DAY = 86_400;

export const STATE: Record<ReportRow["state"], { label: string; tone: StatusTone; order: number }> = {
  blocked: { label: "Blocked", tone: "conflict", order: 0 },
  waiting: { label: "Waiting on teams", tone: "gap", order: 1 },
  done: { label: "Done", tone: "covered", order: 2 },
};

/** $180K, $1.2M, $640; null = the viewer may not see ARR. */
export function usd(n: number | null): string {
  if (n === null) return "Restricted";
  const a = Math.abs(n);
  const s = a >= 1e6 ? `$${trim(a / 1e6)}M` : a >= 1e3 ? `$${trim(a / 1e3)}K` : `$${a}`;
  return n < 0 ? `-${s}` : s;
}
const trim = (v: number) => (Math.round(v * 10) / 10).toString();

/** "Jan 31" (UTC, so server and client agree). */
export const day = (ts: number) => new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(ts * 1000);
export const dayTime = (ts: number) =>
  new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "UTC" }).format(ts * 1000);

export const daysLeft = (effectiveAt: number, now: number) => Math.ceil((effectiveAt - now) / DAY);

/** "in 44 days", "today", "3 days ago". */
export function relDays(effectiveAt: number, now: number): string {
  const d = daysLeft(effectiveAt, now);
  if (d === 0) return "today";
  if (d === 1) return "tomorrow";
  if (d > 0) return `in ${d} days`;
  return d === -1 ? "yesterday" : `${-d} days ago`;
}

/** Worst first: blocked, then waiting, then done; inside a state the lowest coverage, then the soonest date. */
export function worstFirst(rows: ReportRow[]): ReportRow[] {
  return [...rows].sort((a, b) => STATE[a.state].order - STATE[b.state].order || a.coverage.pct - b.coverage.pct || (a.effectiveAt ?? Infinity) - (b.effectiveAt ?? Infinity));
}

export function matches(r: ReportRow, q: string): boolean {
  const s = q.trim().toLowerCase();
  if (!s) return true;
  return [r.id, r.title, r.mainGap?.name ?? "", ...r.systems.map((x) => x.name)].some((t) => t.toLowerCase().includes(s));
}

/** Coverage once `n` more teams are told. */
export const coverageAfter = (c: { told: number; affected: number }, n = 1) =>
  c.affected ? Math.min(100, Math.round(((c.told + n) / c.affected) * 100)) : 100;

/** The sentence under the list title: "1 change this month. 1 needs you." */
export function listSentence(total: number, needYou: number): string {
  const a = `${total} ${total === 1 ? "change" : "changes"} on record.`;
  return needYou ? `${a} ${needYou} ${needYou === 1 ? "needs" : "need"} you.` : `${a} Nothing needs you.`;
}

export const TEAM_STATUS: Record<TeamProgress["status"], { note: (t: TeamProgress) => string; actual: number; tone: "covered" | "gap" | "conflict" }> = {
  acked: { note: (t) => (t.doneAt ? `Told and acked ${day(t.doneAt)}` : "Told and acked"), actual: 100, tone: "covered" },
  told: { note: () => "Told, no ack yet", actual: 50, tone: "gap" },
  not_told: { note: () => "Not told", actual: 0, tone: "conflict" },
};

/** Margin's "+$420 / On plan" column: what is left for this team. */
export const teamDelta = (t: TeamProgress) => (t.status === "acked" ? "Done" : t.status === "told" ? "Ack pending" : "0 of 1");

export const KIND_LABEL: Record<TimelineEvent["kind"], string> = {
  announced: "Announced", traversed: "Traced", proposed: "Proposed", approved: "Approved", rejected: "Rejected", notified: "Notice sent",
  delivered: "Delivered", ack: "Answered", issue: "GitHub issue", conflict: "Conflict found", audit: "Audit", run: "Agent run",
};

/** Dot colour on the timeline: red only for conflicts, amber for rejected (still not told), ink for the rest. */
export const eventTone = (k: TimelineEvent["kind"]): "conflict" | "gap" | "ink" => (k === "conflict" ? "conflict" : k === "rejected" ? "gap" : "ink");

export type Gap = { teamId: string; name: string; figure: string; figureNote: string; body: string; action: string; after: number; arr: number | null; status: TeamProgress["status"] };

/** One card per team still open, worst first (untold before unacked); Legal carries the conflict's ARR when there is one. */
export function gaps(d: ReportDetail): Gap[] {
  const c = d.report.coverage;
  const conflict = d.conflicts.find((x) => x.status === "open");
  const conflictArr = conflict?.contracts.reduce<number | null>((s, k) => (k.arr === null || s === null ? null : s + k.arr), 0) ?? null;
  const contractTeam = conflict ? (d.teams.find((t) => t.teamId === "legal") ?? null) : null;
  return d.teams
    .filter((t) => t.status !== "acked")
    .sort((a, b) => Number(b === contractTeam) - Number(a === contractTeam) || (a.status === b.status ? 0 : a.status === "not_told" ? -1 : 1))
    .map((t) => {
      const told = t.status === "told";
      const after = told ? c.pct : coverageAfter(c);
      const arr = t === contractTeam ? conflictArr : null;
      return {
        teamId: t.teamId, name: t.name, status: t.status, after, arr,
        figure: arr ? `-${usd(arr)}` : told ? "Ack" : `+${after - c.pct} pts`,
        figureNote: arr ? "ARR under contract" : told ? "waiting since they were told" : "coverage if they acknowledge",
        body: `${t.name} ${t.why}${told ? " and has not acked yet." : " and has not been told."} ${t.expected}.`,
        action: `Chase ${t.name}`,
      };
    });
}

/** Teams worst first: not told, told without an ack, then acked. */
export const teamsWorstFirst = (ts: TeamProgress[]) => [...ts].sort((a, b) => TEAM_STATUS[a.status].actual - TEAM_STATUS[b.status].actual);

/** The amber callout sentence, built only from typed contract rows (redaction drops them for non-owners). */
export function noticedSentence(d: ReportDetail): string | null {
  const conflict = d.conflicts.find((x) => x.status === "open");
  const k = conflict?.contracts.find((x) => x.guaranteedUntil);
  if (!conflict) return null;
  if (!k?.guaranteedUntil) return `The ${d.report.effectiveAt ? `${day(d.report.effectiveAt)} ` : ""}sunset clashes with a contract guarantee. The contract text is restricted to its owning team, so only the topology shows here.`;
  const until = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(k.guaranteedUntil * 1000);
  const legal = d.teams.find((t) => t.teamId === "legal");
  const n = conflict.contracts.length - 1;
  const more = n > 0 ? ` ${n} more contract${n > 1 ? "s say" : " says"} the same.` : "";
  const sunset = d.report.effectiveAt ? `The ${day(d.report.effectiveAt)} sunset breaks it.` : "The sunset breaks it.";
  return `${k.name} guarantees ${d.report.systems[0]?.name ?? "the system"} until ${until}. ${sunset}${more}${legal && legal.status === "not_told" ? " Nobody in Legal knows." : ""}`;
}

/** A failed write from the shared demo comes back as 403 demo_readonly. */
export const isReadOnlyError = (e: unknown) => e instanceof Error && e.message === "demo_readonly";

/** Only http(s) links from the API become anchors (no javascript: or data: URLs). */
export const safeUrl = (u: string | null | undefined): string | null => (u && /^https?:\/\//i.test(u) ? u : null);

export type ChaseResult = "sent" | "already" | "proposed";

/**
 * A chase proposes send_reminder (deduped: a repeat returns the existing row), then approves it when the viewer may.
 * Success is only reported when this call approved or enqueued something; "already" when an earlier one did.
 */
export async function runChase(
  propose: () => Promise<{ id: string; status: string }>,
  approve: (id: string) => Promise<boolean>,
  canDecide: boolean,
): Promise<ChaseResult> {
  const p = await propose();
  if (p.status === "approved" || p.status === "executed") return "already";
  if (p.status === "rejected") throw new Error("A reminder for this team was rejected earlier. Reopen it in Approvals to send one.");
  if (p.status !== "pending" && p.status !== "failed") throw new Error(`The reminder is ${p.status}. Check it in Approvals.`);
  if (!canDecide) return "proposed"; // waits in Approvals for an admin or lead
  return (await approve(p.id)) ? "sent" : "already"; // pending -> approve; failed -> approve again (decide allows a retry)
}
