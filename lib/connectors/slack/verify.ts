// Slack request signing: v0=hex(HMAC-SHA256(secret, "v0:<timestamp>:<raw body>")). Reject stale timestamps (replay).
import { createHmac, timingSafeEqual } from "node:crypto";

export const MAX_SKEW_S = 300;

const sign = (secret: string, ts: string | number, body: string) => `v0=${createHmac("sha256", secret).update(`v0:${ts}:${body}`).digest("hex")}`;

/** `nowS` is a test seam (epoch seconds). Never throws: anything malformed is just false. */
export function verifySlack(rawBody: string, headers: Pick<Headers, "get">, secret: string | undefined, nowS = Math.floor(Date.now() / 1000)): boolean {
  const ts = headers.get("x-slack-request-timestamp") ?? "";
  if (!secret || !/^\d+$/.test(ts) || Math.abs(nowS - Number(ts)) > MAX_SKEW_S) return false;
  const want = Buffer.from(sign(secret, ts, rawBody));
  const got = Buffer.from(headers.get("x-slack-signature") ?? "");
  return got.length === want.length && timingSafeEqual(got, want);
}

/** Fixture builder: the headers Slack would send. */
export const signSlack = (rawBody: string, secret: string, ts = Math.floor(Date.now() / 1000)) => ({
  "x-slack-request-timestamp": String(ts),
  "x-slack-signature": sign(secret, ts, rawBody),
});
