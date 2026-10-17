// Server side of /api/it: the IT queue of access requests, and IT marking them granted or denied.
// Ripple never grants access. IT does that in their own system; this records the outcome and tells the person.
// Redaction happens in handle(), not here.
import { z } from "zod";
import { emit } from "./events/emit";
import { query, roQuery } from "./graph/client";
import { load } from "./graph/queries";
import { ItRequest, type ItDecided, type ItQueue } from "./schemas";
import { Forbidden } from "./server/route";
import type { Context } from "./server/context";

/** Admin or lead may decide; the anonymous demo may not (handle() also refuses its writes). */
const mayDecide = (ctx: Context) => ctx.viewer.kind === "user" && (ctx.viewer.role === "admin" || ctx.viewer.role === "lead");

export async function computeIt(ctx: Context): Promise<ItQueue> {
  const rows = await roQuery(ctx.graph, load("it-queue").text);
  return { requests: z.array(ItRequest).parse(rows), canDecide: mayDecide(ctx) };
}

export async function decideIt(ctx: Context, ids: string[], verb: "grant" | "deny"): Promise<ItDecided> {
  if (!mayDecide(ctx)) {
    await ctx.audit({ action: `it.${verb}`, resourceType: "access_request", resourceId: ids.join(","), outcome: "deny" });
    throw new Forbidden("only an admin or team lead can grant or deny access requests");
  }
  const status = verb === "grant" ? "granted" : "denied";
  const by = ctx.viewer.kind === "user" ? ctx.viewer.userId : ctx.viewer.kind;
  const done = await query<{ id: string; personId: string; resourceId: string }>(ctx.writer(), load("it-decide").text, { ids, status, by, now: ctx.now });
  if (verb === "grant")
    for (const r of done)
      await emit((await import("./db")).db(), { type: "access.granted", orgId: ctx.org.id, subject: { kind: "access_request", id: r.id }, payload: { userId: r.personId, resource: r.resourceId }, dedupeKey: `access.granted:${r.id}` });
  await ctx.audit({ action: `it.${verb}`, resourceType: "access_request", resourceId: done.map((r) => r.id).join(","), meta: { requested: ids.length, decided: done.length } });
  return { decided: done.map((r) => r.id), status };
}
