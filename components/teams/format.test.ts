import { expect, test } from "vitest";
import { formatKpi } from "./format";

test("formatKpi by unit", () => {
  expect(formatKpi("usd", 180000)).toBe("$180k");
  expect(formatKpi("usd", 2_400_000)).toBe("$2.4M");
  expect(formatKpi("percent", 82.4)).toBe("82%");
  expect(formatKpi("hours", 0.5)).toBe("30m");
  expect(formatKpi("hours", 4.46)).toBe("4.5h");
  expect(formatKpi("count", 1240)).toBe("1,240");
});
