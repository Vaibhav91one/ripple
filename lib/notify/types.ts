export type Urgency = "high" | "normal" | "low";
export type Channel = "slack_dm" | "slack_channel" | "email" | "inbox";

export type NotificationPlan = {
  personId: string;
  /** Why this person is hearing about it, e.g. `team_owner`, `escalation:96h`. */
  reason: string;
  urgency: Urgency;
  channels: Channel[];
  /** high: unique per plan (sent alone). normal/low: `<personId>:<15-min bucket>` so they collapse into one message. */
  batchKey: string;
  /** `type:subject:person:revision` */
  dedupeKey: string;
  /** Epoch seconds. */
  sendAt: number;
};

/** Synchronous snapshot reads. Implementations return active people only. Unknown ids return []/null. */
export interface GraphReader {
  /** Owner of a change (who raised or is accountable for it). */
  changeOwner(changeId: string): string | null;
  /** Leads/owners of the teams the change gaps (lead found by title, e.g. "Support Lead"). */
  teamOwners(changeId: string): string[];
  /** On-call/owners of the systems the change touches. */
  systemOwners(changeId: string): string[];
  /** People who already acknowledged the change. */
  acknowledgers(changeId: string): string[];
  taskAssignees(taskId: string): string[];
  /** Lead of the person's team, for escalation. Null if the person leads the team or has none. */
  teamLead(personId: string): string | null;
  /** Who grants access to a resource. */
  resourceOwners(resource: string): string[];
  /** Owners/reviewers for the repo behind a PR url. */
  prOwners(url: string): string[];
  /** Everyone who gets the weekly digest. */
  digestRecipients(orgId: string): string[];
  /** Bumps when the subject changes materially, so an update can re-notify. */
  revision(subject: { kind: string; id: string }): string;
}

export type Prefs = {
  /** Normal urgency goes to the team channel instead of a DM. */
  preferTeamChannel?: boolean;
  /** Local wall-clock window `HH:MM`, may wrap midnight. tz is an IANA zone. */
  quietHours?: { start: string; end: string; tz: string };
  /** Explicit per-urgency channel choice; absent urgencies use route's defaults. */
  channels?: Partial<Record<Urgency, Channel[]>>;
  /** false = never send this person the weekly digest. */
  digest?: boolean;
};

export interface PrefsReader {
  get(personId: string): Prefs | undefined;
}
