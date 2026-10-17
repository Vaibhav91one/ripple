import { afterEach, describe, expect, it } from "vitest";
import { randomBytes } from "node:crypto";
import { decrypt, encrypt } from "./crypto";

const k = () => randomBytes(32).toString("base64");
afterEach(() => { delete process.env.RIPPLE_SECRET_KEY; delete process.env.RIPPLE_SECRET_KEY_OLD; });

describe("crypto", () => {
  it("round-trips and uses a fresh nonce", () => {
    process.env.RIPPLE_SECRET_KEY = k();
    const a = encrypt("xoxb-secret"), b = encrypt("xoxb-secret");
    expect(a).toMatch(/^v1:[0-9a-f]{8}:[^:]+:[^:]+:[^:]+$/);
    expect(a).not.toBe(b);
    expect(decrypt(a)).toBe("xoxb-secret");
  });
  it("fails on tampered ciphertext or tag", () => {
    process.env.RIPPLE_SECRET_KEY = k();
    const p = encrypt("hello").split(":");
    const flip = (s: string) => (s[0] === "A" ? "B" : "A") + s.slice(1);
    expect(() => decrypt([...p.slice(0, 3), flip(p[3]), p[4]].join(":"))).toThrow();
    expect(() => decrypt([...p.slice(0, 4), flip(p[4])].join(":"))).toThrow();
    expect(() => decrypt("nope")).toThrow(/format/);
  });
  it("decrypts old-key ciphertext after rotation, selected by kid", () => {
    const oldKey = k();
    process.env.RIPPLE_SECRET_KEY = oldKey;
    const ct = encrypt("rotate me");
    process.env.RIPPLE_SECRET_KEY = k();
    expect(() => decrypt(ct)).toThrow(/kid/);
    process.env.RIPPLE_SECRET_KEY_OLD = oldKey;
    expect(decrypt(ct)).toBe("rotate me");
    expect(decrypt(encrypt("new"))).toBe("new");
  });
  it("errors clearly when the key is missing or malformed", () => {
    expect(() => encrypt("x")).toThrow(/RIPPLE_SECRET_KEY is not set/);
    process.env.RIPPLE_SECRET_KEY = "short";
    expect(() => encrypt("x")).toThrow(/32 bytes/);
  });

  it("rejects a truncated auth tag", () => {
    process.env.RIPPLE_SECRET_KEY = k();
    const parts = encrypt("secret").split(":");
    parts[4] = Buffer.from(parts[4], "base64url").subarray(0, 8).toString("base64url");
    expect(() => decrypt(parts.join(":"))).toThrow();
  });
});
