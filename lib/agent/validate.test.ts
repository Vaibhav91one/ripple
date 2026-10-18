import { describe, expect, it } from "vitest";
import { ASK_WHICH, changeChoices, countRows, invalidIds, needsSource, NOTHING_CONNECTED, validateAnswer, type Names } from "./validate";

const names: Names = new Map([
  ["legal", { name: "Legal", kind: "Team" }],
  ["finance", { name: "Finance", kind: "Team" }],
  ["api-v1", { name: "API v1", kind: "System" }],
  ["support", { name: "Support", kind: "Team" }],
  ["data", { name: "Data", kind: "Team" }],
]);
const hit = { tool: "ripple", args: { decisionId: "d-1" }, rows: [{ teams: [{ teamId: "legal", why: ["owns API v1"] }], conflicts: [] }] };
const empty = { tool: "ripple", args: { decisionId: "d-2" }, rows: [{ teams: [], conflicts: [] }] };

describe("validateAnswer", () => {
  it("counts teams, not wrapper rows", () => {
    expect(countRows(hit.rows)).toBe(1);
    expect(countRows(empty.rows)).toBe(0);
    expect(countRows([{ found: false }, { error: "x" }])).toBe(0);
  });
  it("accepts an answer whose entities are in the rows", () => {
    const v = validateAnswer("Legal owns API v1 [[a]].", [hit], names);
    expect(v).toMatchObject({ ok: true, outcome: { outcome: "path", rowCount: 1, entities: ["Legal", "API v1"] } });
  });
  it("rejects an entity no tool returned and rebuilds from the rows", () => {
    const v = validateAnswer("Finance is affected.", [hit], names);
    expect(v.ok).toBe(false);
    expect(v.answer).toBe("Ripple found 1 team: Legal. Paths: Legal via owns API v1.");
  });
  it("rejects no-impact on an empty traversal as not_in_graph", () => {
    const v = validateAnswer("No impact, it is safe.", [empty], names);
    expect(v).toMatchObject({ ok: false, outcome: { outcome: "not_in_graph" } });
    expect(v.answer).toBe(NOTHING_CONNECTED);
    expect(v.answer).not.toMatch(/graph|unverified/i);
  });
  it("tells an unknown entity from an empty one", () => {
    const unknown = { tool: "who_knows", args: { systemId: "fax" }, rows: [{ found: false, knownSystems: [{ id: "api-v1" }] }] };
    const known = { tool: "who_knows", args: { systemId: "api-v1" }, rows: [{ found: false, knownSystems: [{ id: "api-v1" }] }] };
    expect(validateAnswer("", [unknown], names).outcome.outcome).toBe("unknown_entity");
    expect(validateAnswer("", [known], names).outcome.outcome).toBe("not_in_graph");
  });
  it("single-word names count only when written as names", () => {
    const ok = (t: string) => validateAnswer(t, [hit], names).ok;
    expect(ok("The support tickets show Legal is hit.")).toBe(true); // ordinary phrase
    expect(ok("Support tickets show Legal is hit.")).toBe(true); // sentence start, no cue
    expect(ok("Legal is hit, and the data shows more.")).toBe(true);
    expect(ok("Legal is hit; Support is affected.")).toBe(false); // capitalised mid-sentence
    expect(ok("Legal is hit. Support is affected.")).toBe(false); // sentence start + verb cue
    expect(ok("Legal is hit. The support team is affected.")).toBe(false); // "team" cue, any case
    expect(ok("Legal is hit, plus Data and Support.")).toBe(false); // list
  });
  it("ignores the viewer's own team and words the question used", () => {
    expect(validateAnswer("Legal is hit; Support is fine.", [hit], names, { viewerTeamIds: ["support"] }).ok).toBe(true);
    expect(validateAnswer("Legal is hit by Data volume.", [hit], names, { question: "what about data volume?" }).ok).toBe(true);
    expect(validateAnswer("Legal is hit by Data volume.", [hit], names, { question: "Is Data affected?" }).ok).toBe(false);
  });
  it("accepts an honest not-found answer", () => {
    expect(validateAnswer("The graph has nothing on fax; it may not be modelled.", [empty], names).ok).toBe(true);
  });
});

describe("invalidIds", () => {
  it("flags ids no tool returned, at any depth and in arrays", () => {
    expect(invalidIds({ teams: [{ teamId: "legal" }, { teamId: "finance" }], systemIds: ["api-v1", "x-9"] }, [hit], { decisionId: "d-1" })).toEqual(["teamId=finance", "systemIds=api-v1", "systemIds=x-9"]);
  });
  it("accepts ids from the rows and from the input", () => {
    expect(invalidIds({ teamId: "legal", systemId: "s1" }, [hit], { systemId: "s1" })).toEqual([]);
  });
});

describe("plain-language outcomes (#268)", () => {
  it("shows the no-source notice for factual claims only", () => {
    expect(needsSource("Hi! What can I look up for you?", [])).toBe(false);
    expect(needsSource("Sure, happy to help.", [])).toBe(false);
    expect(needsSource("Which change do you mean?", [hit])).toBe(false);
    expect(needsSource("Legal owns it.", [hit])).toBe(true);
    expect(needsSource("The sunset is Jan 31.", [])).toBe(true);
  });
  it("turns an unknown change into a clarification with the real changes as choices", () => {
    const unknown = { tool: "ripple", args: { decisionId: "sunset" }, rows: [{ found: false, knownDecisions: [{ id: "d-1", title: "Sunset API v1" }, { id: "d-2", title: "Rotate keys" }] }] };
    const v = validateAnswer("Sunset affects Legal.", [unknown], names);
    expect(v.outcome.outcome).toBe("unknown_entity");
    expect(v.answer).toBe(ASK_WHICH);
    expect(v.answer).not.toMatch(/decision id/i);
    expect(changeChoices([unknown], "Who is affected?")).toEqual([
      { label: "Sunset API v1", prompt: 'About "Sunset API v1": Who is affected' },
      { label: "Rotate keys", prompt: 'About "Rotate keys": Who is affected' },
    ]);
  });
  it("reads choices from a list_decisions result", () => {
    const list = { tool: "list_decisions", args: {}, rows: [{ id: "d-1", title: "Sunset API v1", status: "accepted" }] };
    expect(changeChoices([list], "")).toEqual([{ label: "Sunset API v1", prompt: "What does Sunset API v1 touch?" }]);
  });
  it("words an unknown system without internals", () => {
    const unknown = { tool: "who_knows", args: { systemId: "fax" }, rows: [{ found: false, knownSystems: [{ id: "api-v1" }] }] };
    expect(validateAnswer("Fax is hit.", [unknown], names).answer).toBe('I don\'t recognise "fax", so I haven\'t looked anything up. Check the name and ask again.');
  });
});
