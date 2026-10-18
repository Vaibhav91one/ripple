import { describe, expect, it } from "vitest";
import { Analytics } from "../analytics";
import { Activity, ReportDetail, ReportList } from "../reports";
import activity from "./activity.json";
import analytics from "./analytics.json";
import reports from "./reports.json";

describe("v2 report and analytics fixtures", () => {
  it("parse against their contracts", () => {
    expect(ReportList.parse(reports.list).cases[0].id).toBe("d-1");
    expect(ReportDetail.parse(reports.detail).timeline.some((e) => e.demo)).toBe(true);
    expect(Activity.parse(activity).items.length).toBeGreaterThan(0);
    expect(Analytics.parse(analytics).coverage?.pct).toBe(40);
  });
});
