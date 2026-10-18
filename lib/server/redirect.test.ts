import { describe, expect, it } from "vitest";
import { publicOrigin, redirectTo } from "./redirect";

describe("redirects behind the proxy", () => {
  it("redirectTo is relative", () => {
    const r = redirectTo("/items/x", 303);
    expect(r.status).toBe(303);
    expect(r.headers.get("location")).toBe("/items/x");
  });
  it("publicOrigin prefers APP_URL, then forwarded headers, then req.url", () => {
    const req = new Request("https://0.0.0.0:3000/x", { headers: { "x-forwarded-host": "ripple.example", "x-forwarded-proto": "https" } });
    const old = process.env.APP_URL;
    process.env.APP_URL = "https://app.example/";
    expect(publicOrigin(req)).toBe("https://app.example");
    delete process.env.APP_URL;
    expect(publicOrigin(req)).toBe("https://ripple.example");
    expect(publicOrigin(new Request("https://0.0.0.0:3000/x"))).toBe("https://0.0.0.0:3000");
    if (old) process.env.APP_URL = old;
  });
});
