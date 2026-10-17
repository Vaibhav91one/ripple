// Minimal Slack Web API client. Plain fetch (no @slack/web-api: we use a handful of methods and need our own 429 + per-channel pacing).
export class SlackError extends Error {
  constructor(public method: string, public code: string) { super(`slack ${method}: ${code}`); }
}

type Deps = { fetch?: typeof fetch; sleep?: (ms: number) => Promise<void>; now?: () => number };
type Params = Record<string, string | number | boolean>;
const realSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const MAX_RETRIES = 3;
const POST_GAP_MS = 1000; // chat.postMessage: about 1 message per second per channel

// Note: conversations.history/replies are Tier 1 (1 req/min, 15 objects) for new non-Marketplace installs since 2025-05-29.
// Don't poll them; record "told" from message.* events and the ts of our own posts.
export function slackClient(token: string, deps: Deps = {}) {
  const f = deps.fetch ?? fetch;
  const sleep = deps.sleep ?? realSleep;
  const now = deps.now ?? Date.now;
  const nextPostAt = new Map<string, number>(); // ponytail: per-process; share the limiter if the worker scales out
  const emails = new Map<string, { id: string; at: number }>();

  async function call<T = Record<string, unknown>>(method: string, params: Params = {}): Promise<T> {
    for (let attempt = 0; ; attempt++) {
      const res = await f(`https://slack.com/api/${method}`, {
        method: "POST",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)])),
      });
      if (res.status === 429) {
        if (attempt >= MAX_RETRIES) throw new SlackError(method, "ratelimited");
        const s = Number(res.headers.get("retry-after"));
        await sleep((Number.isFinite(s) && s > 0 ? s : 1) * 1000);
        continue;
      }
      const body = (await res.json()) as { ok: boolean; error?: string } & T;
      if (!body.ok) throw new SlackError(method, body.error ?? `http_${res.status}`);
      return body;
    }
  }

  return {
    call,
    /** Waits for the channel's slot first, so bursts to one channel go out 1 per second. */
    async postMessage(channel: string, text: string, extra: Params = {}) {
      const at = Math.max(now(), nextPostAt.get(channel) ?? 0);
      nextPostAt.set(channel, at + POST_GAP_MS); // reserve synchronously so concurrent callers queue behind each other
      if (at > now()) await sleep(at - now());
      return call<{ ts: string; channel: string }>("chat.postMessage", { channel, text, ...extra });
    },
    /** Slack user id for an email, cached 1h (null = no such user). Match it to the graph Person with the same email. */
    async userIdByEmail(email: string): Promise<string | null> {
      const key = email.trim().toLowerCase();
      const hit = emails.get(key);
      if (hit && now() - hit.at < 3_600_000) return hit.id || null;
      let id = "";
      try {
        id = (await call<{ user: { id: string } }>("users.lookupByEmail", { email: key })).user.id;
      } catch (e) {
        if (!(e instanceof SlackError && e.code === "users_not_found")) throw e;
      }
      emails.set(key, { id, at: now() });
      return id || null;
    },
  };
}
