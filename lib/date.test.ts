import { describe, expect, it } from "vitest";
import { fmtDate, isoToWords } from "./date";

describe("date style", () => {
  it("formats epoch seconds as Jan 31, 2027 in UTC", () => {
    expect(fmtDate(Date.UTC(2027, 0, 31, 23, 59) / 1000)).toBe("Jan 31, 2027");
  });
  it("turns ISO dates into words and leaves non-dates alone", () => {
    expect(isoToWords("2027-06-30")).toBe("Jun 30, 2027");
    expect(isoToWords("2027-13-40")).toBe("2027-13-40");
    expect(isoToWords("soon")).toBe("soon");
  });
});
