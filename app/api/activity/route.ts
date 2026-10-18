import { z } from "zod";
import { activity } from "@/lib/reports";
import { bad, handle, params } from "@/lib/server/route";
import { Activity } from "@/lib/schemas/reports";

/** Every event across cases, newest first. `actor` filters by agent, person or system. */
export function GET(req: Request) {
  const q = params(req, z.object({ actor: z.enum(["all", "person", "agent", "system"]).default("all"), limit: z.coerce.number().int().min(1).max(200).default(50) }));
  if (bad(q)) return q;
  return handle(Activity, (ctx) => activity(ctx, q.actor, q.limit));
}
