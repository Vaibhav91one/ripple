import { clickDelivery } from "@/lib/notify/track";

// Tracked `open` link in messages: record the click on the delivery, then go to the item. The target comes from the
// stored notification, never from the URL, so this is not an open redirect. Unknown delivery or no database -> home.
export async function GET(req: Request, ctx: RouteContext<"/r/[id]">) {
  const { id } = await ctx.params;
  const s = await clickDelivery(id).catch(() => null);
  const path = !s ? "/" : s.kind === "digest" ? `/agents/runs/${encodeURIComponent(s.id)}` : `/items/${encodeURIComponent(s.kind)}/${encodeURIComponent(s.id)}`; // a digest is an agent run
  return Response.redirect(new URL(path, req.url), 302);
}
