import { describe, expect, it } from "vitest";
import { RATE_LIMIT } from "@/lib/agent/limits";
import { askEvents } from "@/lib/mock/ledgerly";
import { StreamEvent } from "@/lib/schemas";
import { POST } from "./route";

const req = (question: string, ip: string) =>
  new Request("http://x/api/ask", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": ip },
    body: JSON.stringify({ question }),
  });
const events = async (res: Response) =>
  (await res.text()).split("\n\n").filter(Boolean).map((f) => StreamEvent.parse(JSON.parse(f.replace(/^data: /, ""))));

describe("POST /api/ask", () => {
  it("streams the cached answer when no model is configured", async () => {
    delete process.env.LLM_PROVIDER;
    const res = await POST(req("Who knows the v1 auth flow?", "1.1.1.1"));
    expect(res.headers.get("content-type")).toContain("text/event-stream");
    expect(await events(res)).toEqual(askEvents);
  });

  it("says no key is configured for other questions", async () => {
    delete process.env.LLM_PROVIDER;
    const ev = await events(await POST(req("What is for lunch?", "1.1.1.2")));
    expect(ev[0]).toMatchObject({ type: "text_delta" });
    expect(ev.at(-1)).toEqual({ type: "done" });
  });

  it("returns 429 after the rate limit", async () => {
    delete process.env.LLM_PROVIDER;
    for (let i = 0; i < RATE_LIMIT; i++) expect((await POST(req("hi", "2.2.2.2"))).status).toBe(200);
    expect((await POST(req("hi", "2.2.2.2"))).status).toBe(429);
  });
});
