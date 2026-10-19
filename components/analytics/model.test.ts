import { describe, expect, it } from "vitest";
import { Analytics, type Scenario } from "@/lib/schemas/analytics";
import fixture from "@/lib/schemas/fixtures/analytics.json";
import { systemGap, actFirst, coverageSentence, exposedArr, forecastPoints, defaultOn, fmtHours, fmtUsd, forecastWith, heatmapGrid, heatmapSentence, scenarioLabel, timeSentence, waterfallAxis } from "./model";

const a = Analytics.parse(fixture);

describe("formatting", () => {
  it("formats ARR compactly", () => {
    expect([fmtUsd(950), fmtUsd(62_000), fmtUsd(180_000), fmtUsd(1_250_000), fmtUsd(62_400), fmtUsd(-3_000)]).toEqual(["$950", "$62K", "$180K", "$1.3M", "$62.4K", "−$3K"]);
  });
  it("formats hours, switching to days past two days", () => {
    expect([fmtHours(36), fmtHours(47), fmtHours(600)]).toEqual(["36 h", "47 h", "25 days"]);
  });
  it("writes the coverage sentence from the data", () => {
    expect(coverageSentence(a)).toBe("40% of affected teams told. 3 teams and $180K ARR still exposed before Jan 31, 2027.");
  });
  it("starts the waterfall axis under the actual", () => {
    expect(waterfallAxis(40).ticks.map((t) => t.value)).toEqual([40, 60, 80, 100]);
    expect(waterfallAxis(62)).toMatchObject({ min: 50, max: 100 });
  });
  it("drops the API's not-yet-proposed suffix from the card label", () => {
    expect(scenarioLabel(a.forecast!.scenarios[0])).toBe("Notify Legal");
  });
  it("says who is still waiting", () => {
    expect(timeSentence(a.timeToTell)).toBe("Teams are told in a median 36 h. Legal, Security and DevRel have waited 25 days and counting.");
  });
});

describe("heatmap", () => {
  it("maps cells onto team rows and gap columns", () => {
    const { rows, columns } = heatmapGrid(a.heatmap);
    expect(rows.map((r) => r.teamId)).toEqual(["legal", "security", "devrel", "sales", "support"]);
    const legal = rows[0];
    expect(legal.cells.map((c) => c?.gap ?? null)).toEqual(["not_told", null, "contract_conflict", null]);
    expect(legal.cells[2]?.arrAtRisk).toBe(180_000);
    expect(rows.find((r) => r.teamId === "support")?.cells.every((c) => c === null)).toBe(true);
    expect(columns.map((c) => c.total)).toEqual([3, 0, 1, 2]);
  });
  it("takes ARR exposed from the contract-conflict cell only; null when restricted or absent", () => {
    expect(exposedArr(a)).toBe(180_000);
    const restricted = { ...a, heatmap: { ...a.heatmap, cells: a.heatmap.cells.map((c) => ({ ...c, arrAtRisk: null })) } };
    expect(exposedArr(restricted)).toBeNull();
    expect(coverageSentence(restricted)).toBe("40% of affected teams told. 3 teams still exposed before Jan 31, 2027.");
  });
  it("never sums ARR: it only appears on the cell that owns it", () => {
    const { rows, columns } = heatmapGrid(a.heatmap);
    expect(Object.keys(columns[0])).not.toContain("arrAtRisk");
    expect(Object.keys(rows[0])).not.toContain("arrAtRisk");
    expect(rows.flatMap((r) => r.cells).filter((c) => c?.arrAtRisk).length).toBe(1);
    expect(heatmapSentence(a.heatmap)).toContain("Legal holds the $180K of ARR at risk");
  });
  it("filters to one team", () => {
    expect(heatmapGrid(a.heatmap, "sales").rows.map((r) => r.teamId)).toEqual(["sales"]);
  });
  it("ranks where to act first by ARR, then severity", () => {
    const cards = actFirst(a);
    expect(cards.map((c) => c.key)).toEqual(["legal|contract_conflict", "legal|not_told", "security|not_told"]);
    expect(cards[0]).toMatchObject({ figure: "$180K", chip: null, action: { label: "Trace it", href: "?d=d-1&team=legal#graph" } });
    expect(cards[0].note).toBe("A contract this team owns conflicts with the change.");
    expect(cards[1]).toMatchObject({ figure: "20 pts", chip: "waiting 25 days" });
  });
  it("gives coverage points to not-told gaps only; others show their count", () => {
    const overdue = actFirst({ ...a, heatmap: { ...a.heatmap, cells: [{ teamId: "legal", gap: "overdue", count: 2, arrAtRisk: null }] } });
    expect(overdue[0]).toMatchObject({ figure: "2", figureNote: "tasks open", chip: null, note: "Tasks past their due date, counted across the org." });
  });
});

describe("forecast toggles", () => {
  const s = (id: string, pts: number, source: Scenario["source"]): Scenario => ({ id, label: id, teamId: id, pts, source, actionId: source === "pending" ? `a-${id}` : null });
  const f = { projectedPct: 40, scenarios: [s("p1", 20, "pending"), s("p2", 10, "pending"), s("d1", 20, "derived"), s("d2", 30, "derived")] };

  it("starts with pending actions on and derived ones off", () => {
    expect([...defaultOn(f.scenarios)]).toEqual(["p1", "p2"]);
    expect(defaultOn(a.forecast!.scenarios).size).toBe(0);
  });
  it("counts only pending scenarios toward approvals", () => {
    expect(forecastWith(f, new Set(["p1", "d1"]))).toEqual({ approvals: 60, ifProposed: 80, gainPts: 20, proposedPts: 20 });
    expect(forecastWith(f, new Set(["d1"])).approvals).toBe(40);
  });
  it("caps at 100%", () => {
    expect(forecastWith(f, new Set(["p1", "p2", "d1", "d2"]))).toMatchObject({ approvals: 70, ifProposed: 100, proposedPts: 30 });
  });
  it("never reads below the current path", () => {
    const g = { projectedPct: 60, scenarios: f.scenarios };
    expect(forecastWith(g, new Set()).approvals).toBe(60);
    expect(forecastWith(g, new Set(["p2"]))).toMatchObject({ approvals: 70, gainPts: 10 });
  });
  it("projects nothing without an effective date", () => {
    expect(forecastPoints(a)?.projected).toBe(true);
    const none = forecastPoints({ ...a, forecast: { ...a.forecast!, effectiveAt: null, daysLeft: null } })!;
    expect(none.projected).toBe(false);
    expect(none.actual.at(-1)?.[0]).toBe(1); // the axis ends today
  });
});

describe("system gaps and waiting days", () => {
  const nodes = [
    { id: "api-v1", kind: "system", title: "API v1", status: "neutral" as const },
    { id: "auth", kind: "system", title: "auth-service", status: "neutral" as const },
    { id: "sec", kind: "team", title: "Security", status: "gap" as const },
    { id: "sup", kind: "team", title: "Support", status: "covered" as const },
    { id: "c-contracts", kind: "contracts", title: "Contracts", status: "conflict" as const },
  ];
  const edges = [{ from: "sec", to: "auth" }, { from: "sup", to: "api-v1" }, { from: "c-contracts", to: "api-v1" }, { from: "auth", to: "api-v1" }];
  it("a system with a conflicting contract is a conflict; one owned by an untold team is a gap", () => {
    expect(systemGap("api-v1", nodes, edges)).toEqual({ status: "conflict", teams: [] });
    expect(systemGap("auth", nodes, edges)).toEqual({ status: "gap", teams: ["Security"] });
    expect(systemGap("nothing", nodes, edges).status).toBe("neutral");
  });
  it("counts whole days waited, so 635 h is 26 days everywhere", () => {
    expect(fmtHours(635)).toBe("26 days");
    expect(fmtHours(47.6)).toBe("48 h");
  });
});
