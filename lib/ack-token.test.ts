import { describe, expect, it } from "vitest";
import { decodeAckToken, demoToken, encodeAckToken } from "./ack-token";

const now = 1_800_000_000;
describe("decodeAckToken", () => {
  it("accepts a valid signed token", () => {
    const r = decodeAckToken(demoToken("legal"), now);
    expect(r.state).toBe("ok");
    expect(r.state !== "invalid" && r.payload.teamId).toBe("legal");
  });
  it("flags expired", () => {
    expect(decodeAckToken(encodeAckToken({ teamId: "legal", decisionId: "d-1", exp: now - 1 }), now).state).toBe("expired");
  });
  it("flags already acknowledged", () => {
    expect(decodeAckToken(demoToken("legal", { acked: true }), now).state).toBe("acked");
  });
  it("rejects a tampered payload or signature", () => {
    const [body, sig] = demoToken("legal").split(".");
    const forged = Buffer.from(JSON.stringify({ teamId: "security", decisionId: "d-1", exp: 4_102_444_800 })).toString("base64url");
    expect(decodeAckToken(`${forged}.${sig}`, now).state).toBe("invalid");
    expect(decodeAckToken(`${body}.${sig.slice(0, -2)}AA`, now).state).toBe("invalid");
  });
  it("rejects an unsigned (old demo) token", () => {
    const old = Buffer.from(JSON.stringify({ teamId: "legal", decisionId: "d-1", exp: 4_102_444_800 })).toString("base64url");
    expect(decodeAckToken(old, now).state).toBe("invalid");
  });
  it("rejects garbage", () => {
    expect(decodeAckToken("not-a-token", now).state).toBe("invalid");
    expect(decodeAckToken("", now).state).toBe("invalid");
    expect(decodeAckToken("a.b.c", now).state).toBe("invalid");
  });
});
