// conflict.found: one event per conflict that is new this run (detectConflicts().created). Re-running detection creates none, so nothing re-emits.
import type { Conflict } from "../schemas";

export async function emitConflictsFound(orgId: string, r: { data: Conflict[]; created: string[] }): Promise<void> {
  if (!r.created.length) return;
  const [{ db }, { emit }] = await Promise.all([import("../db"), import("./emit")]); // lazy: lib/db is "server-only"
  for (const id of r.created) {
    const c = r.data.find((x) => x.id === id);
    if (!c) continue;
    await emit(db(), {
      type: "conflict.found", orgId, subject: { kind: "conflict", id },
      payload: { changeId: c.decisionId, conflictsWith: c.contractIds[0] ?? c.decisionId }, dedupeKey: `conflict:${orgId}:${id}`,
    });
  }
}
