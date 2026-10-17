import { afterEach, describe, expect, it, vi } from "vitest";

import { NextRequest } from "next/server";
vi.mock("server-only", () => ({}));
import { POST } from "./route";

afterEach(() => delete process.env.CLERK_WEBHOOK_SIGNING_SECRET);

describe("POST /api/webhooks/clerk", () => {
  it("503 when unconfigured", async () => {
    expect((await POST(new NextRequest("http://x/api/webhooks/clerk", { method: "POST", body: "{}" }))).status).toBe(503);
  });
  it("400 on an unsigned request", async () => {
    process.env.CLERK_WEBHOOK_SIGNING_SECRET = "whsec_dGVzdA==";
    expect((await POST(new NextRequest("http://x/api/webhooks/clerk", { method: "POST", body: "{}" }))).status).toBe(400);
  });
});
