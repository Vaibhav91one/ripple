import { describe, expect, it } from "vitest";
import { StreamEvent } from "@/lib/schemas";
import { STARTER_PROMPTS } from "./prompts";
import { classify, helpChips, reply, type TalkKind } from "./smalltalk";

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
    for (const k of ["hello", "how", "thanks", "bye", "who", "help"] as const) for (let i = 0; i < 3; i++) expect(reply(k, () => i)).not.toMatch(/decision id|graph|cypher|node|unverified/i);
  });
});

describe("helpChips", () => {
  it("falls back to the starter prompts and the pages", () => {
    const c = helpChips();
    expect(c.map((x) => x.label)).toEqual([STARTER_PROMPTS[2], "Any contract conflicts?", "Show the graph", "Meet the agents", "Connect your tools"]);
    expect(c.filter((x) => x.href).map((x) => x.href)).toEqual(["/graph", "/agents", "/integrations"]);
  });
  it("names the real latest change and reuses the cached starter for the demo change", () => {
    const c = helpChips([{ id: "d-1", title: "Sunset API v1 on Jan 31" }, { id: "d-9", title: "Rotate keys" }]);
    expect(c[0]).toEqual({ label: "What does Sunset API v1 on Jan 31 touch?", prompt: STARTER_PROMPTS[1] });
    expect(c.find((x) => x.label === "Who hasn't been told about Sunset API v1 on Jan 31?")?.prompt).toBe(STARTER_PROMPTS[2]);
    expect(helpChips([{ id: "d-9", title: "Rotate keys" }]).find((x) => x.label.startsWith("Who"))?.prompt).toBe("Which teams have not been told about Rotate keys?");
  });
  it("parses as a stream event", () => {
    expect(StreamEvent.parse({ type: "suggestions", kind: "help", items: helpChips() }).type).toBe("suggestions");
  });
});
