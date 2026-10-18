import { describe, expect, it } from "vitest";
import { StreamEvent } from "@/lib/schemas";
import { STARTER_PROMPTS } from "./prompts";
import { classify, helpChips, reply, starterChips, type TalkKind } from "./smalltalk";

describe("classify", () => {
  const cases: [string, TalkKind][] = [
    ["hi", "hello"], ["Hello!", "hello"], ["hey there", "hello"], ["Good morning", "hello"], ["hi ripple", "hello"],
    ["thanks", "thanks"], ["Thank you so much!", "thanks"], ["ok thanks", "thanks"], ["cheers", "thanks"],
    ["bye", "bye"], ["good night", "bye"],
    ["how are you?", "how"], ["hi, how are you", "how"], ["what's up", "how"],
    ["who are you?", "who"], ["what is Ripple", "who"],
    ["help", "help"], ["What can you do?", "help"], ["what can I ask", "help"],
  ];
  for (const [text, kind] of cases) it(`"${text}" is ${kind}`, () => expect(classify(text)).toBe(kind));

  it("leaves real questions alone, even when they start with a greeting", () => {
    for (const q of ["hi, who isn't told about v1?", "thanks, what does the sunset touch?", "Who knows the v1 auth flow?", "help me find the conflicts for d-1", "hello what teams are hit", "", "?"])
      expect(classify(q), q).toBeUndefined();
  });
});

describe("reply", () => {
  it("varies, stays short, and says what Ripple can do in plain words", () => {
    const hellos = new Set([0, 1, 2].map((i) => reply("hello", () => i)));
    expect(hellos.size).toBe(3);
    for (const k of ["hello", "how", "who", "help"] as const) expect(reply(k, () => 0)).toMatch(/who a change affects/);
    for (const k of ["hello", "how", "thanks", "bye", "who", "help", "offtopic", "link"] as const) for (let i = 0; i < 3; i++) expect(reply(k, () => i)).not.toMatch(/decision id|graph|cypher|node|unverified/i);
  });
});

describe("off-topic and links (#274)", () => {
  it("answers the weather and other everyday questions politely, with no model", () => {
    for (const q of ["what's the weather in Paris tomorrow?", "Tell me a joke", "who won the football last night", "bitcoin price today?"]) expect(classify(q), q).toBe("offtopic");
    const r = reply("offtopic", () => 0);
    expect(r).toMatch(/only know about your company's changes/);
    expect(r).not.toMatch(/no impact|rewrote|first draft/i);
  });
  it("keeps company questions that share a word", () => {
    for (const q of ["Does the weather service change affect Support?", "Which team owns the forecast API?", "Who knows the v1 auth flow?"]) expect(classify(q), q).toBeUndefined();
  });
  it("gives a pasted link one coherent reply", () => {
    expect(classify("https://example.com/blog/post?id=3")).toBe("link");
    expect(classify("<https://example.com>")).toBe("link");
    expect(reply("link", () => 0)).toMatch(/can't open links/);
    expect(classify("what does https://x.test/rfc-14 change?")).toBeUndefined();
  });
});

describe("starterChips: one chip set for home and after hi (#274)", () => {
  const facts = { changes: [{ id: "c-7", title: "Move billing to Stripe" }, { id: "c-6", title: "Rotate keys" }], systems: [{ id: "gh:acme/web", name: "acme/web" }], conflicts: 1 };
  it("the demo and the Ledgerly sample get the cached starters", () => {
    expect(starterChips().map((c) => c.prompt)).toEqual([...STARTER_PROMPTS]);
    expect(starterChips({ ...facts, changes: [{ id: "d-1", title: "Sunset API v1 on Jan 31" }] }).map((c) => c.prompt)).toEqual([...STARTER_PROMPTS]);
  });
  it("an org gets chips from its own changes, conflicts and repos", () => {
    expect(starterChips(facts).map((c) => c.label)).toEqual([
      "What does Move billing to Stripe touch?", "Who hasn't been told about Move billing to Stripe?", "Any contract conflicts?", "What does Rotate keys touch?", "Who knows acme/web?",
    ]);
    expect(starterChips(facts)[1].prompt).toBe("Which teams have not been told about Move billing to Stripe?");
  });
  it("an empty org gets no question chips; help offers the connect links instead", () => {
    const empty = { changes: [], systems: [], conflicts: 0 };
    expect(starterChips(empty)).toEqual([]);
    expect(helpChips(empty).map((c) => c.href)).toEqual(["/connections/github", "/connections/slack", "/connections/csv"]);
    expect(helpChips()).toEqual(starterChips());
  });
  it("parses as a stream event", () => {
    expect(StreamEvent.parse({ type: "suggestions", kind: "help", items: helpChips() }).type).toBe("suggestions");
  });
});
