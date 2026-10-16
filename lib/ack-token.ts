import { z } from "zod";

// Mock token: base64url JSON. Real HMAC signing comes in #16.
const Payload = z.object({
  teamId: z.string().min(1),
  decisionId: z.string().min(1),
  exp: z.number().int(), // epoch seconds
  acked: z.boolean().optional(), // demo flag: already acknowledged
});
export type AckPayload = z.infer<typeof Payload>;

export type AckTokenState =
  | { state: "ok"; payload: AckPayload }
  | { state: "expired" | "acked"; payload: AckPayload }
  | { state: "invalid" };

export const encodeAckToken = (p: AckPayload) =>
  Buffer.from(JSON.stringify(p)).toString("base64url");

/** Pure: `now` is epoch seconds. Never throws. */
export function decodeAckToken(token: string, now = Math.floor(Date.now() / 1000)): AckTokenState {
  try {
    const payload = Payload.parse(JSON.parse(Buffer.from(token, "base64url").toString("utf8")));
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
