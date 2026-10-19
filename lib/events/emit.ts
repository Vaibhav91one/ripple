// Append-only event log. emit() inserts with dedupe; with no DATABASE_URL it is a silent no-op.
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { env } from "../env";
import { enqueue } from "../queue";
import type { RippleEvent } from "./types";

/** A db() or a transaction: anything with insert(). */
type Executor = Pick<PostgresJsDatabase, "insert">;

export async function emit(tx: Executor, event: RippleEvent): Promise<{ inserted: boolean; id?: string }> {
  if (!env().DATABASE_URL) return { inserted: false };
  const { events } = await import("../db/schema");
  const [row] = await tx
    .insert(events)
    .values({
      orgId: event.orgId, type: event.type, subjectKind: event.subject.kind, subjectId: event.subject.id,
      payload: event.payload, dedupeKey: event.dedupeKey,
    })
    .onConflictDoNothing({ target: events.dedupeKey })
    .returning({ id: events.id });
  if (row) await onEventInserted(row.id, event);
  return { inserted: !!row, id: row?.id };
}

/** One team.member_added per team; the dedupe key makes a repeat (webhook retry, second PATCH) a no-op. */
export async function emitMemberAdded(tx: Executor, orgId: string, personId: string, teamIds: string[], userId?: string): Promise<void> {
  for (const teamId of teamIds) {
    await emit(tx, { type: "team.member_added", orgId, subject: { kind: "team", id: teamId }, payload: { teamId, personId, userId }, dedupeKey: `member:${orgId}:${teamId}:${personId}` });
  }
}

/** Runs only for newly inserted events. enqueue() never throws and no-ops without DATABASE_URL. */
async function onEventInserted(id: string, event: RippleEvent): Promise<void> {
  await enqueue("route-event", { eventId: id, type: event.type, orgId: event.orgId }, { singletonKey: event.dedupeKey });
}
