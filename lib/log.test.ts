import { describe, expect, it } from "vitest";
import { redactSecrets, safeMessage } from "./log";

describe("redactSecrets", () => {
  it.each([
    ["slack", "auth failed xoxb-123-abc-DEF", "xoxb-123"],
    ["slack user", "xoxp-1-2-3abc", "xoxp-1"],
    ["github app", "token ghs_AbC123xyz used", "ghs_AbC123xyz"],
    ["github pat", "ghp_AbC123xyz", "ghp_AbC123xyz"],
    ["api key", "key sk-proj_abc-123 rejected", "sk-proj_abc-123"],
    ["ripple key", "rpl_live_abc123", "rpl_live_abc123"],
    ["token_enc json", `{"token_enc":"v1:aa:bb:cc:dd","kind":"slack"}`, "v1:aa:bb:cc:dd"],
    ["token_enc sql", "insert ... token_enc = v1:aa:bb:cc:dd, kind", "v1:aa:bb:cc:dd"],
  ])("masks %s", (_n, input, secret) => {
    const out = redactSecrets(input);
    expect(out).not.toContain(secret);
    expect(out).toContain("[redacted]");
  });
  it("leaves clean text alone and handles Error", () => {
    expect(redactSecrets("connection refused")).toBe("connection refused");
    expect(safeMessage(new Error("bad ghs_zzz"))).toBe("bad [redacted]");
    expect(redactSecrets(`{"token_enc":"x","kind":"slack"}`)).toContain(`"kind":"slack"`);
  });
  it("reads pg-boss's plain error objects instead of [object Object]", () => {
    expect(safeMessage({ message: "connection terminated ghs_zzz", stack: "x", queue: "github-reply", code: "57P01" })).toBe("connection terminated [redacted] (queue github-reply) [57P01]");
    expect(safeMessage({ a: 1 })).toBe('{"a":1}');
    expect(safeMessage("plain")).toBe("plain");
  });
});
