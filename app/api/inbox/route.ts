import { z } from "zod";
import { inbox } from "@/lib/graph/queries";
import { bad, handle, params } from "@/lib/server/route";
import { Inbox } from "@/lib/schemas";


export function GET(req: Request) {
  const q = params(req, z.object({ p: z.string().min(1) }));
  if (bad(q)) return q;
  return handle(Inbox, async ({ graph, now }) => (await inbox(graph, q.p, now)).data);
}
