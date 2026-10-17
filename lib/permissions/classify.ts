// What is restricted and who owns it. Pure (no graph code) so the UI can phrase the "restricted to X" line.
// Rule: topology is open to everyone; payload belongs to the owning team; leadership sees counts and totals only.
import type { RestrictedSummary } from "../schemas/common";

export type RestrictedKind = RestrictedSummary["kind"];

/** Node label -> restricted kind. Anything else (Decision, Team, Task, acks, gap, counts) is open. */
export const LABEL_KIND: Record<string, Exclude<RestrictedKind, "source">> = {
  Contract: "contract", Clause: "clause", Deal: "deal", Finding: "finding", Control: "control",
};
/** Owning team of each restricted node kind. */
export const KIND_OWNER: Record<Exclude<RestrictedKind, "source">, string> = {
  contract: "legal", clause: "legal", deal: "sales", finding: "security", control: "security",
};
/** A source quote belongs to the team whose restricted payload it backs (the edge type that cites it). */
export const EDGE_OWNER: Record<string, string> = {
  GUARANTEES: "legal", HAS_CLAUSE: "legal", DRAFT_DOC: "legal", PROMISED: "sales", FOUND_IN: "security", COVERS: "security",
};
/** Customer ARR is owned by Sales. */
export const ARR_OWNER = "sales";
export const LEADERSHIP = "leadership";
export const RESTRICTED_QUOTE = "[restricted]";
export const RESTRICTED_TITLE = "Restricted source";

const TEAM_NAME: Record<string, string> = {
  eng: "Engineering", support: "Support", sales: "Sales", legal: "Legal", security: "Security", devrel: "DevRel", leadership: "Leadership",
};
export const teamName = (id: string) => TEAM_NAME[id] ?? id;
const NOUN: Record<RestrictedKind, string> = { contract: "contract", clause: "clause", deal: "deal", finding: "finding", control: "control", source: "source" };
export const kindNoun = (k: RestrictedKind, n = 1) => (n === 1 ? NOUN[k] : `${NOUN[k]}s`);

/** "2 contracts — restricted to Legal" */
export const restrictedLine = (s: Pick<RestrictedSummary, "kind" | "owner" | "count">) =>
  `${s.count} ${kindNoun(s.kind, s.count)} — restricted to ${teamName(s.owner)}`;
