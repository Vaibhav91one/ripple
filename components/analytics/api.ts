// Client fetch for GET /api/analytics (kept out of lib/api.ts, which another change owns).
import { GraphDownError } from "@/lib/api";
import { Analytics } from "@/lib/schemas/analytics";

export async function getAnalytics(): Promise<Analytics> {
  const res = await fetch("/api/analytics");
  if (res.status === 503) throw new GraphDownError();
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string; error?: string };
    throw new Error(body.message ?? body.error ?? `/api/analytics: ${res.status}`);
  }
  return Analytics.parse(await res.json());
}
