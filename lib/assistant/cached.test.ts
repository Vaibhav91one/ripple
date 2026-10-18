import { describe, expect, it } from "vitest";
import { StreamEvent } from "@/lib/schemas";
import { agents } from "@/lib/agent/registry";
import { cachedAnswer, tour } from "./cached";
import { AGENT_SAMPLES, isCachedPrompt, STARTER_PROMPTS } from "./prompts";

describe("cached prompts", () => {
  it("every starter and agent sample has a valid cached answer with a citation", () => {
    for (const p of [...STARTER_PROMPTS, ...Object.values(AGENT_SAMPLES)]) {
      const a = cachedAnswer(p);
      expect(isCachedPrompt(p)).toBe(true);
      expect(a, p).toBeDefined();
      for (const e of a!) StreamEvent.parse(e);
      expect(a!.some((e) => e.type === "citation"), p).toBe(true);
    }
  });
  it("matches loosely and has a sample for every agent", () => {
    expect(cachedAnswer("who knows the V1 auth flow")).toBeDefined();
    expect(cachedAnswer("something else")).toBeUndefined();
    for (const a of agents()) expect(AGENT_SAMPLES[a.name], a.name).toBeTruthy();
  });
  it("the tour is a valid stream", () => {
    for (const e of tour()) StreamEvent.parse(e);
  });
});
