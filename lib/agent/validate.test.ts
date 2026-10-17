import { describe, expect, it } from "vitest";
import { countRows, invalidIds, validateAnswer, type Names } from "./validate";

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
    expect(v.answer).toContain("does not mean no impact");
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
