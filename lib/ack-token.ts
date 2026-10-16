import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";

// Signed token: base64url(JSON payload) + "." + base64url(HMAC-SHA256). Secret: ACK_TOKEN_SECRET.
const Payload = z.object({
  teamId: z.string().min(1),
  decisionId: z.string().min(1),
  exp: z.number().int(), // epoch seconds
  r: z.enum(["seen", "concern", "not_relevant"]).optional(), // suggested reply
  acked: z.boolean().optional(), // demo flag: already acknowledged (styleguide/screenshots)
});
export type AckPayload = z.infer<typeof Payload>;

export type AckTokenState =
  | { state: "ok"; payload: AckPayload }
  | { state: "expired" | "acked"; payload: AckPayload }
  | { state: "invalid" };

let warned = false;
function secret(): string {
  const s = process.env.ACK_TOKEN_SECRET;
  if (s) return s;
  if (!warned) {
    warned = true;
    console.warn("ACK_TOKEN_SECRET is not set: signing ack tokens with an insecure dev default. Set it before deploying.");
  }
  return "ripple-dev-ack-secret";
}
const mac = (body: string) => createHmac("sha256", secret()).update(body).digest("base64url");

export function encodeAckToken(p: AckPayload): string {
  const body = Buffer.from(JSON.stringify(p)).toString("base64url");
  return `${body}.${mac(body)}`;
}

/** Pure: `now` is epoch seconds. Never throws. */
export function decodeAckToken(token: string, now = Math.floor(Date.now() / 1000)): AckTokenState {
  try {
    const [body, sig, extra] = token.split(".");
    if (!body || !sig || extra !== undefined) return { state: "invalid" };
    const want = Buffer.from(mac(body)), got = Buffer.from(sig);
    if (want.length !== got.length || !timingSafeEqual(want, got)) return { state: "invalid" };
    const payload = Payload.parse(JSON.parse(Buffer.from(body, "base64url").toString("utf8")));
    if (payload.exp < now) return { state: "expired", payload };
    if (payload.acked) return { state: "acked", payload };
    return { state: "ok", payload };
  } catch {
    return { state: "invalid" };
  }
}

const FAR = 4_102_444_800; // 2100-01-01
/** Demo tokens for the styleguide, email preview and screenshots. */
export const demoToken = (teamId: string, opts: Partial<AckPayload> = {}) =>
  encodeAckToken({ teamId, decisionId: "d-1", exp: FAR, ...opts });
