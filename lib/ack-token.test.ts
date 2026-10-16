import { describe, expect, it } from "vitest";
import { decodeAckToken, demoToken, encodeAckToken } from "./ack-token";

const now = 1_800_000_000;
describe("decodeAckToken", () => {
  it("accepts a valid token", () => {
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
  it("rejects garbage, bad JSON and wrong shape", () => {
    expect(decodeAckToken("not-a-token", now).state).toBe("invalid");
    expect(decodeAckToken("", now).state).toBe("invalid");
    expect(decodeAckToken(Buffer.from('{"teamId":1}').toString("base64url"), now).state).toBe("invalid");
  });
});
