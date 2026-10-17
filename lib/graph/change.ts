// Change lifecycle: draft -> confirmed; a moved date or scope creates a new Change that SUPERSEDES the old one.
import { z } from "zod";
import { query, roQuery, type Graph } from "./client";
import { load } from "./queries";
import { ChangeNode } from "../schemas";

const Row = ChangeNode.and(z.object({ systems: z.array(z.string()) }));
export type ChangeWithSystems = z.infer<typeof Row>;
export type ChangeDraft = Omit<ChangeNode, "status" | "owner" | "sourceRef" | "quote"> &
  Partial<Pick<ChangeNode, "owner" | "sourceRef" | "quote">> & { systems?: string[] };

/** True when people must re-acknowledge: effective date, affected systems or kind changed. Title edits never count. */
export function materialDiff(
  a: Pick<ChangeWithSystems, "effectiveAt" | "kind" | "systems">,
  b: Pick<ChangeWithSystems, "effectiveAt" | "kind" | "systems">,
): boolean {
  const sys = (x: string[]) => [...new Set(x)].sort().join(",");
  return a.effectiveAt !== b.effectiveAt || a.kind !== b.kind || sys(a.systems) !== sys(b.systems);
}

export async function getChange(g: Graph, id: string): Promise<ChangeWithSystems | null> {
  const rows = await roQuery(g, load("change-get").text, { id });
  return rows[0] && rows[0].id ? Row.parse(rows[0]) : null;
}

export async function createDraft(g: Graph, c: ChangeDraft, now: number): Promise<void> {
  await query(g, load("change-create-draft").text, {
    owner: null, sourceRef: null, quote: null, systems: [], ...c, now,
  });
}

/** Returns false when the change does not exist or is not a draft. */
export async function confirm(g: Graph, id: string, now: number): Promise<boolean> {
  return (await query(g, load("change-confirm").text, { id, now })).length > 0;
}

/** Write `next` (a new Change), link it over `oldId` and close the old one. `material` says whether to re-ask for acks. */
export async function supersede(g: Graph, oldId: string, next: ChangeDraft, now: number): Promise<{ id: string; material: boolean }> {
  const old = await getChange(g, oldId);
  if (!old) throw new Error(`Change ${oldId} not found`);
  await createDraft(g, next, now);
  await query(g, load("change-supersede").text, { oldId, newId: next.id, now });
  return { id: next.id, material: materialDiff(old, { ...next, systems: next.systems ?? [] }) };
}
