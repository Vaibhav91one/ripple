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

/** Runs only for newly inserted events. enqueue() never throws and no-ops without DATABASE_URL. */
async function onEventInserted(id: string, event: RippleEvent): Promise<void> {
  await enqueue("route-event", { eventId: id, type: event.type, orgId: event.orgId }, { singletonKey: event.dedupeKey });
}
