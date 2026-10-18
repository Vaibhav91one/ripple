import { describe, expect, it } from "vitest";
import { Analytics, type Scenario } from "@/lib/schemas/analytics";
import fixture from "@/lib/schemas/fixtures/analytics.json";
import { actFirst, coverageSentence, defaultOn, fmtHours, fmtUsd, forecastWith, heatmapGrid, heatmapSentence, scenarioLabel, timeSentence, waterfallAxis } from "./model";

const a = Analytics.parse(fixture);

describe("formatting", () => {
  it("formats ARR compactly", () => {
    expect([fmtUsd(950), fmtUsd(62_000), fmtUsd(180_000), fmtUsd(1_250_000), fmtUsd(62_400), fmtUsd(-3_000)]).toEqual(["$950", "$62K", "$180K", "$1.3M", "$62.4K", "−$3K"]);
  });
  it("formats hours, switching to days past two days", () => {
    expect([fmtHours(36), fmtHours(47), fmtHours(600)]).toEqual(["36 h", "47 h", "25 days"]);
  });
  it("writes the coverage sentence from the data", () => {
    expect(coverageSentence(a)).toBe("40% of affected teams told. 3 teams and $180K ARR still exposed before Jan 31.");
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
    expect(cards[0]).toMatchObject({ figure: "$180K", action: { label: "Trace it", href: "?team=legal#graph" } });
    expect(cards[1]).toMatchObject({ figure: "20 pts", chip: "waiting 25 days" });
  });
});

describe("forecast toggles", () => {
  const s = (id: string, pts: number, source: Scenario["source"]): Scenario => ({ id, label: id, teamId: id, pts, source, actionId: source === "pending" ? `a-${id}` : null });
  const f = { currentPct: 40, scenarios: [s("p1", 20, "pending"), s("p2", 10, "pending"), s("d1", 20, "derived"), s("d2", 30, "derived")] };

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
  it("matches the API's withApprovalsPct when every pending action is on", () => {
    expect(forecastWith(a.forecast!, defaultOn(a.forecast!.scenarios)).approvals).toBe(a.forecast!.withApprovalsPct);
  });
});
