import { describe, expect, it } from "vitest";
import type { Change } from "@/lib/schemas";
import { DAY, defaultSince, filterChanges, typeCounts } from "./helpers";

const c = (type: Change["edge"]["type"], at: number, kind: Change["kind"] = "added"): Change => ({
  kind, at, edge: { from: "a", to: "b", type, validFrom: at, validTo: null },
});
const all = [c("USES", 100), c("PROMISED", 300), c("USES", 200, "ended")];

describe("changes helpers", () => {
  it("defaults since to 7 days before the latest change", () => {
    expect(defaultSince(all)).toBe(300 - 7 * DAY);
    expect(defaultSince([])).toBe(0);
  });
  it("filters by type and sorts newest first", () => {
    expect(filterChanges(all, []).map((x) => x.at)).toEqual([300, 200, 100]);
    expect(filterChanges(all, ["USES"]).map((x) => x.at)).toEqual([200, 100]);
  });
  it("counts types", () => {
    expect(typeCounts(all)).toEqual([["USES", 2], ["PROMISED", 1]]);
  });
});
