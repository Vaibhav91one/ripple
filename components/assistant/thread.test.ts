import { describe, expect, it } from "vitest";
import { STARTER_PROMPTS } from "@/lib/assistant/prompts";
import type { StreamEvent } from "@/lib/schemas";
import { answerText, applyEvent, expandCommand, plainAnswer, resultNote, toolLabel, traceSummary, loadThreads, newTurn, saveThreads, THREADS_KEY, threadsKey, toMessages, turnsFromMessages, upsertThread, type Thread } from "./thread";

const run = (events: StreamEvent[]) => events.reduce(applyEvent, newTurn("q"));
const meta = (over: Partial<Extract<StreamEvent, { type: "meta" }>> = {}): StreamEvent => ({ type: "meta", remaining: 3, limit: 30, cached: false, exhausted: false, persist: false, ...over });
const rfc = { artifactId: "art-rfc14", quote: "API v1 will be shut down" };
const msa = { artifactId: "art-msa", quote: "guarantees v1" };

describe("applyEvent", () => {
  it("numbers citations per artifact in first-cited order and reuses numbers", () => {
    const t = run([
      { type: "text_delta", text: "Sunset. " },
      { type: "citation", claimId: "c1", sources: [rfc, msa] },
      { type: "text_delta", text: "Again." },
      { type: "citation", claimId: "c2", sources: [{ ...msa, quote: "guarantees v1 until 2027" }] },
      { type: "done" },
    ]);
    expect(t.sources.map((s) => [s.n, s.artifactId])).toEqual([[1, "art-rfc14"], [2, "art-msa"]]);
    expect(t.sources[1].quote).toBe("guarantees v1 until 2027"); // the richer quote wins
    expect(t.tokens.filter((k) => k.cite).map((k) => k.cite)).toEqual([1, 2, 2]);
    expect(answerText(t)).toBe("Sunset.[1][2] Again.[2]");
    expect(t.done).toBe(true);
  });

  it("joins sub-word deltas and pairs tool results with their call", () => {
    const t = run([
      { type: "tool_call", tool: "ripple", args: { decisionId: "d-1" }, cypher: "MATCH (n) RETURN n" },
      { type: "tool_result", tool: "ripple", rows: [{ a: 1 }], sourceIds: [], ms: 12 },
      { type: "text_delta", text: "couldn" },
      { type: "text_delta", text: "'t stop" },
    ]);
    expect(t.tools[0]).toMatchObject({ tool: "ripple", rowCount: 1, ms: 12 });
    expect(t.tokens.map((k) => k.text)).toEqual(["couldn't", "stop"]);
  });

  it("reads cached, exhausted and agent from meta", () => {
    expect(run([meta({ cached: true })])).toMatchObject({ cached: true, exhausted: false });
    expect(run([meta({ exhausted: true, cached: true, remaining: 0, agent: "contract" })])).toMatchObject({ exhausted: true, agent: "contract" });
  });

  it("marks validator rewrites", () => {
    expect(run([{ type: "done", rejected: ["unknown entity"] }]).rejected).toBe(true);
    expect(run([{ type: "done" }]).rejected).toBe(false);
  });
});

describe("toMessages", () => {
  it("sends finished turns as history and the new question last", () => {
    const done = { ...run([{ type: "text_delta", text: "Yes." }, { type: "done" }]), question: "first" };
    const failed = { ...newTurn("broken"), done: true, error: "x" };
    expect(toMessages([done, failed], "next")).toEqual([
      { role: "user", content: "first" },
      { role: "assistant", content: "Yes." },
      { role: "user", content: "next" },
    ]);
  });
});

describe("expandCommand", () => {
  it("maps bare commands to the cached starters", () => {
    expect(expandCommand("/impact")).toEqual({ prompt: STARTER_PROMPTS[1] });
    expect(expandCommand("/who-wasnt-told")).toEqual({ prompt: STARTER_PROMPTS[2] });
    expect(expandCommand("/conflicts")).toEqual({ prompt: STARTER_PROMPTS[3] });
  });
  it("takes arguments and opens case files", () => {
    expect(expandCommand("/impact the pricing change")).toEqual({ prompt: "What does the pricing change touch?" });
    expect(expandCommand("/report d-1")).toEqual({ href: "/reports/d-1" });
    expect(expandCommand("plain question")).toEqual({ prompt: "plain question" });
  });
});

describe("localStorage history", () => {
  const mem = () => {
    const m = new Map<string, string>();
    return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), m };
  };
  const thread = (id: string, at: number): Thread => ({ id, title: id, updatedAt: at, turns: [newTurn("q")] });

  it("keys history by lens", () => {
    const s = mem();
    saveThreads([thread("a", 1)], s, threadsKey("legal"));
    expect(loadThreads(s, threadsKey("legal"))).toHaveLength(1);
    expect(loadThreads(s, threadsKey("sales"))).toEqual([]);
  });

  it("round-trips threads and saves streaming turns as finished", () => {
    const s = mem();
    saveThreads([thread("a", 2)], s);
    const [t] = loadThreads(s);
    expect(t.id).toBe("a");
    expect(t.turns[0].done).toBe(true);
    expect(s.m.has(THREADS_KEY)).toBe(true);
  });

  it("survives junk and blocked storage", () => {
    expect(loadThreads({ getItem: () => "{not json" })).toEqual([]);
    expect(loadThreads({ getItem: () => JSON.stringify([{ nope: 1 }, thread("b", 1)]) }).map((t) => t.id)).toEqual(["b"]);
    const bad = { ...thread("d", 1), turns: [{ ...newTurn("q"), tokens: [{ text: 5 }] }] };
    expect(loadThreads({ getItem: () => JSON.stringify([bad, { ...thread("e", 1), title: null }]) })).toEqual([]);
    expect(loadThreads({ getItem: () => { throw new Error("blocked"); } })).toEqual([]);
    expect(() => saveThreads([thread("c", 1)], { setItem: () => { throw new Error("quota"); } })).not.toThrow();
  });

  it("keeps newest first on upsert", () => {
    const list = upsertThread([thread("a", 1), thread("b", 2)], thread("a", 3));
    expect(list.map((t) => t.id)).toEqual(["a", "b"]);
  });
});

describe("turnsFromMessages", () => {
  it("replays stored events, or falls back to the stored text", () => {
    const turns = turnsFromMessages([
      { role: "user", content: "q1" },
      { role: "assistant", content: "ignored", events: [{ type: "text_delta", text: "Hi " }, { type: "citation", claimId: "c", sources: [rfc] }] },
      { role: "user", content: "q2" },
      { role: "assistant", content: "plain answer" },
    ]);
    expect(turns.map((t) => [t.question, answerText(t), t.done])).toEqual([["q1", "Hi[1]", true], ["q2", "plain answer", true]]);
  });
});

describe("suggestions (#268)", () => {
  it("keeps chips on the turn, with no outcome, and survives a save and load", () => {
    const t = run([
      { type: "text_delta", text: "Which change do you mean?" },
      { type: "suggestions", kind: "choose", items: [{ label: "Sunset API v1", prompt: 'About "Sunset API v1": Who is affected' }] },
      { type: "done" },
    ]);
    expect(t).toMatchObject({ done: true, outcome: undefined, suggestions: { kind: "choose", items: [{ label: "Sunset API v1" }] } });
    const mem = new Map<string, string>();
    saveThreads([{ id: "a", title: "t", updatedAt: 1, turns: [t] }], { setItem: (k, v) => void mem.set(k, v) });
    expect(loadThreads({ getItem: (k) => mem.get(k) ?? null })[0].turns[0].suggestions?.items[0].label).toBe("Sunset API v1");
  });
});

describe("#274: follow-ups keep context, copy and trace in plain words", () => {
  it("the history for 'which of those customers pays the most' carries the customers and the $180K, without [n] markers", async () => {
    const { cachedAnswer } = await import("@/lib/assistant/cached");
    const conflict = { ...cachedAnswer(STARTER_PROMPTS[3])!.reduce(applyEvent, newTurn(STARTER_PROMPTS[3])), done: true };
    const msgs = toMessages([conflict], "Which of those customers pays us the most?");
    expect(msgs.map((m) => m.role)).toEqual(["user", "assistant", "user"]);
    const prior = msgs[1].content;
    expect(prior).toMatch(/Northwind Capital and Halden Bank/);
    expect(prior).toMatch(/\$180K/);
    expect(prior).toMatch(/contract_conflicts \{"decisionId":"d-1"\}/); // what was looked up, for the model only
    expect(prior).not.toMatch(/\[\d+\]/);
    expect(prior.length).toBeLessThanOrEqual(4000);
    expect(plainAnswer(conflict)).not.toMatch(/\[\d+\]|2027-06-30/);
  });
  it("names tools in plain words and folds the trace to a count", () => {
    expect(toolLabel("contract_conflicts")).toBe("Contract conflicts");
    expect(toolLabel("some_new_tool")).toBe("Some new tool");
    expect(traceSummary(1)).toBe("Checked 1 source");
    expect(traceSummary(2)).toBe("Checked 2 sources");
    expect([resultNote(undefined), resultNote(0), resultNote(3)]).toEqual(["checking…", "nothing found", "3 results"]);
  });
});
