import { describe, expect, it } from "vitest";
import { z } from "zod";
import { defineAgent, type AgentDef } from "./define";
import { agent, agents } from "./registry";
import { ask } from "./agents/ask";
import { READ_TOOLS, TOOLS } from "./tools";

const base: AgentDef = {
  name: "t", group: "ask", team: "eng", model: "reasoning", tools: ["search"], writes: [],
  budget: { maxSteps: 1, maxTokens: 1 }, trigger: {}, input: z.object({}), output: z.object({}), system: () => "",
};

describe("defineAgent", () => {
  it("accepts a valid definition", () => expect(defineAgent(base).name).toBe("t"));
  it("throws on an unknown tool", () => expect(() => defineAgent({ ...base, tools: ["nope" as never] })).toThrow(/unknown tool "nope"/));
  it("rejects a propose tool unless writes lists its kind", () => {
    for (const [tool, kind] of [["propose_draft", "draft_doc"], ["propose_task", "create_task"], ["create_tasks", "create_task"]] as const) {
      expect(() => defineAgent({ ...base, tools: [tool] }), tool).toThrow(/proposes/);
      expect(defineAgent({ ...base, tools: [tool], writes: [kind] }).tools).toEqual([tool]);
    }
  });
  it("Ask cannot be given a propose tool", () => {
    expect(() => defineAgent({ ...ask, tools: [...ask.tools, "propose_draft"] })).toThrow(/propose_draft.*draft_doc/);
    expect(ask.tools.some((t) => TOOLS[t].proposes)).toBe(false);
  });
  it("throws on an unknown write kind", () => expect(() => defineAgent({ ...base, writes: ["rm_rf" as never] })).toThrow(/unknown write kind/));
});

describe("registry", () => {
  it("lists ask with every read tool and no writes", () => {
    expect(agents().map((a) => a.name)).toContain("ask");
    expect(agent("ask")?.tools).toEqual(READ_TOOLS);
    expect(agent("ask")?.writes).toEqual([]);
    expect(agent("missing")).toBeUndefined();
  });
  it("lists impact (read-only) and contract (drafts and tasks only)", () => {
    expect(agent("impact")?.writes).toEqual([]);
    expect(agent("contract")?.writes).toEqual(["draft_doc", "create_task"]);
  });
});
