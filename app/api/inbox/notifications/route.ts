import { z } from "zod";
import { env } from "@/lib/env";
import { NotificationList } from "@/lib/schemas";
import { getContext } from "@/lib/server/context";

const empty: NotificationList = { notifications: [], unread: 0 };
const noStore = { "cache-control": "no-store" }; // differs per viewer

/** The signed-in viewer's notifications. Anonymous demo viewers, no Postgres, or a user not linked to a Person: empty, not an error. */
export async function GET(req: Request) {
  const { viewer, org } = await getContext(req);
  if (viewer.kind !== "user" || !viewer.personId || !env().DATABASE_URL) return Response.json(empty, { headers: noStore });
  const { listNotifications } = await import("@/lib/notify/inbox");
  return Response.json(NotificationList.parse(await listNotifications(org.id, viewer.personId)), { headers: noStore });
}

const Body = z.union([z.object({ ids: z.array(z.string().uuid()).min(1).max(200) }), z.object({ all: z.literal(true) })]);

/** Mark read: `{ids: [...]}` or `{all: true}`. Only ever touches the viewer's own rows. */
export async function POST(req: Request) {
  const ctx = await getContext(req);
  const { viewer } = ctx;
  if (viewer.kind !== "user" || !viewer.personId) return Response.json({ error: "forbidden" }, { status: 403 });
  if (!env().DATABASE_URL) return Response.json({ error: "db_not_configured" }, { status: 503 });
  const body = Body.safeParse(await req.json().catch(() => null));
  if (!body.success) return Response.json({ error: "bad_request", message: body.error.message }, { status: 400 });
  const { markRead } = await import("@/lib/notify/inbox");
  return Response.json({ updated: await markRead(ctx.org.id, viewer.personId, "all" in body.data ? "all" : body.data.ids) });
}
