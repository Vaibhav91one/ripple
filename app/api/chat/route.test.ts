import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { LoopOpts } from "@/lib/agent/loop";
import { spend } from "@/lib/agent/limits";
import { STARTER_PROMPTS } from "@/lib/assistant/prompts";
import { askEvents } from "@/lib/mock/ledgerly";
import { StreamEvent } from "@/lib/schemas";

const seen: LoopOpts[] = [];
let model: unknown = null;
vi.mock("@/lib/llm", () => ({ pickModel: () => model }));
vi.mock("@/lib/server/context", () => ({
  getContext: async () => ({ writer: () => ({}), now: 1, org: { isDemo: true }, readonly: true, viewer: { kind: "anon", teamIds: [] }, audit: async () => {} }),
}));
vi.mock("@/lib/agent/loop", () => ({
  runAgent: async function* (o: LoopOpts) {
    seen.push(o);
    yield { type: "text_delta", text: `live:${o.question}` };
    yield { type: "done" };
  },
}));
const { POST } = await import("./route");

let n = 0;
/** A fresh visitor (cookie + ip) per call unless `v` is given. */
const post = (body: unknown, v = `v${++n}`) =>
  POST(new Request("http://x/api/chat", { method: "POST", headers: { "content-type": "application/json", cookie: `ripple_vid=${v}`, "x-forwarded-for": `10.0.0.${v}` }, body: JSON.stringify(body) }));
const events = async (res: Response) => (await res.text()).split("\n\n").filter(Boolean).map((f) => StreamEvent.parse(JSON.parse(f.replace(/^data: /, ""))));
const text = (ev: StreamEvent[]) => ev.flatMap((e) => (e.type === "text_delta" ? [e.text] : [])).join("");
const meta = (ev: StreamEvent[]) => ev[0] as Extract<StreamEvent, { type: "meta" }>;
const user = (content: string) => ({ role: "user", content });

beforeEach(() => { seen.length = 0; model = null; delete process.env.DEMO_PROMPTS_PER_DAY; delete process.env.DAILY_TOKEN_BUDGET; });
afterEach(() => vi.unstubAllEnvs());

describe("POST /api/chat", () => {
  it("validates the body", async () => {
    expect((await post({ messages: [] })).status).toBe(400);
    expect((await post({ messages: [{ role: "assistant", content: "hi" }] })).status).toBe(400);
    expect((await post({ messages: [user("hi")], agent: "nope" })).status).toBe(400);
  });

  it("works with no DB and no LLM key: starter prompts come from the cache, others get a notice", async () => {
    const cached = await events(await post({ messages: [user(STARTER_PROMPTS[0])] }));
    expect(meta(cached)).toMatchObject({ cached: true, exhausted: false, persist: false, remaining: null });
    expect(cached.slice(1)).toEqual(askEvents);
    const other = await events(await post({ messages: [user("What is for lunch?")] }));
    expect(text(other)).toContain("No model key");
    expect(other.at(-1)).toEqual({ type: "done" });
  });

  it("sets the visitor cookie once", async () => {
    const fresh = await POST(new Request("http://x/api/chat", { method: "POST", body: JSON.stringify({ messages: [user(STARTER_PROMPTS[0])] }) }));
    expect(fresh.headers.get("set-cookie")).toMatch(/^ripple_vid=[\w-]+;/);
    expect((await post({ messages: [user(STARTER_PROMPTS[0])] })).headers.get("set-cookie")).toBeNull();
  });

  it("passes earlier turns to the model as context", async () => {
    model = {};
    const ev = await events(await post({ messages: [user("Who owns auth?"), { role: "assistant", content: "Priya." }, user("and her team?")] }));
    expect(text(ev)).toBe("live:and her team?");
    expect(seen[0].question).toBe("and her team?");
    expect(seen[0].history).toEqual([user("Who owns auth?"), { role: "assistant", content: "Priya." }]);
    expect(seen[0].system).toBeUndefined();
  });

  it("routes @agent and the agent param to that agent's prompt and read tools", async () => {
    model = {};
    await events(await post({ messages: [user("@contract is clause 7.2 at risk?")] }));
    expect(seen[0].question).toBe("is clause 7.2 at risk?");
    expect(seen[0].system).toContain("Contract Sentinel");
    expect(seen[0].toolNames?.length).toBeGreaterThan(0);
    expect(seen[0].toolNames).not.toContain("create_tasks");
    const ev = await events(await post({ messages: [user("who is exposed?")], agent: "exposure" }));
    expect(meta(ev).agent).toBe("exposure");
    expect(seen[1].system).toContain("Customer Exposure");
    await events(await post({ messages: [user("@nobody hello")] })); // unknown mention is plain text
    expect(seen[2].question).toBe("@nobody hello");
  });

  it("decrements the daily quota on live prompts only, then serves the cached tour", async () => {
    model = {};
    vi.stubEnv("DEMO_PROMPTS_PER_DAY", "2");
    const v = "quota1";
    const ask = (q: string) => post({ messages: [user(q)] }, v).then(events);
    expect(meta(await ask("live one"))).toMatchObject({ remaining: 1, limit: 2, cached: false });
    expect(meta(await ask(STARTER_PROMPTS[1]))).toMatchObject({ remaining: 1, cached: true }); // exempt: no decrement
    expect(meta(await ask("live two"))).toMatchObject({ remaining: 0 });
    const out = await ask("live three");
    expect(meta(out)).toMatchObject({ remaining: 0, exhausted: true, cached: true });
    expect(text(out)).toContain("demo budget is used up");
    expect(out.some((e) => e.type === "citation")).toBe(true);
    expect(seen.map((s) => s.question)).toEqual(["live one", "live two"]);
    const free = await ask(STARTER_PROMPTS[2]); // still free when the budget is gone
    expect(meta(free)).toMatchObject({ exhausted: false, cached: true, remaining: 0 });
    expect(text(free)).toContain("Legal");
  });

  it("counts by IP too, so a new cookie from the same IP does not reset the quota", async () => {
    model = {};
    vi.stubEnv("DEMO_PROMPTS_PER_DAY", "1");
    const same = (cookie: string) => POST(new Request("http://x/api/chat", { method: "POST", headers: { cookie: `ripple_vid=${cookie}`, "x-forwarded-for": "9.9.9.9" }, body: JSON.stringify({ messages: [user("q")] }) })).then(events);
    expect(meta(await same("a1")).exhausted).toBe(false);
    expect(meta(await same("a2")).exhausted).toBe(true);
  });

  it("falls back to the tour when the global token cap is spent", async () => {
    model = {};
    vi.stubEnv("DAILY_TOKEN_BUDGET", "100");
    spend(500);
    await new Promise((r) => setTimeout(r, 5));
    const out = await events(await post({ messages: [user("anything live")] }));
    expect(meta(out)).toMatchObject({ exhausted: true });
    expect(seen).toHaveLength(0);
  });
});

describe("/api/conversations in the demo", () => {
  it("tells the client to keep threads in localStorage", async () => {
    const { GET, POST: create } = await import("../conversations/route");
    expect(await (await GET()).json()).toEqual({ persist: false, conversations: [] });
    expect((await create(new Request("http://x", { method: "POST", body: "{}" }))).status).toBe(200);
    const { DELETE } = await import("../conversations/[id]/route");
    expect(await (await DELETE(new Request("http://x"), { params: Promise.resolve({ id: "x" }) })).json()).toMatchObject({ persist: false });
  });
});
