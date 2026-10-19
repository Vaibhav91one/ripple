// One sentence per graph edge, so no screen shows raw edge names like WAITING_ON. Pure: safe in the browser.
import type { Edge } from "./schemas";
import { fmtDate } from "./date";

const day = fmtDate;

/** [verb phrase between "<from>" and "<to>", whether to append "since <date>"] per edge type. */
const PHRASE: Partial<Record<Edge["type"], [string, boolean?]>> = {
  WAITING_ON: ["has been waiting on", true], BLOCKED_BY: ["is blocked by"], SUNSETS: ["sunsets"], DEPENDS_ON: ["depends on"],
  USES: ["uses"], OWNS: ["owns"], CARES_ABOUT: ["cares about"], ABOUT: ["is about"], RAISED_BY: ["was raised by"],
  HANDLED_BY: ["is handled by"], PROMISED: ["was promised"], GUARANTEES: ["guarantees"], PARTY_TO: ["is party to"],
  OWNED_BY: ["is owned by"], MANAGED_BY: ["is managed by"], INVOLVED_IN: ["was involved in"], ACKED: ["acknowledged"],
  AFFECTED: ["is affected by"], NOTIFIES: ["notifies"], MEMBER_OF: ["joined"], ASSIGNED: ["is assigned to"],
  AUTHORED: ["authored"], REVIEWED: ["reviewed"], REQUESTED_REVIEW: ["asked for a review of"], CAUSED_BY: ["was caused by"],
  FOUND_IN: ["was found in"], COVERS: ["covers"], SUPERSEDES: ["supersedes"], MAINTAINS: ["maintains"],
};

/** "Product has been waiting on Legal since 13 Oct", "Support uses API v1". `name` resolves an id to a label. */
export function describeEdge(e: Pick<Edge, "from" | "to" | "type" | "validFrom">, name: (id: string) => string, dated = true): string {
  const [verb, since] = PHRASE[e.type] ?? [e.type.toLowerCase().replaceAll("_", " ")];
  return `${name(e.from)} ${verb} ${name(e.to)}${since && dated ? ` since ${day(e.validFrom)}` : ""}`;
}
