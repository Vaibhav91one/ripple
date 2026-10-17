import type { NextRequest } from "next/server";
import { verifyWebhook } from "@clerk/nextjs/webhooks";
import { applyClerkEvent, type ClerkEvent } from "@/lib/clerk-sync";
import { env } from "@/lib/env";

// Clerk -> Postgres sync (svix-signed). 503 when not configured, 400 on a bad signature.
export async function POST(req: NextRequest) {
  if (!env().CLERK_WEBHOOK_SIGNING_SECRET) return Response.json({ error: "webhook_not_configured" }, { status: 503 });
  let evt: ClerkEvent;
  try {
    evt = (await verifyWebhook(req)) as unknown as ClerkEvent;
  } catch {
    return Response.json({ error: "bad_signature" }, { status: 400 });
  }
  const handled = await applyClerkEvent(evt);
  return Response.json({ ok: true, handled });
}
