import { describe, expect, it } from "vitest";
import { rippleResult } from "@/lib/mock/ledgerly";
import { RippleResult } from "@/lib/schemas";
import { applySunsetMove } from "./applySunsetMove";

const JUL_15 = Date.UTC(2027, 6, 15) / 1000;

describe("applySunsetMove", () => {
  const after = applySunsetMove(rippleResult, JUL_15);

  it("resolves conflicts and zeroes the risk counts", () => {
    expect(rippleResult.counts.conflicts).toBe(1);
    expect(after.counts.conflicts).toBe(0);
    expect(after.counts.arrAtRisk).toBe(0);
    expect(after.conflicts.every((c) => c.status === "resolved")).toBe(true);
  });

  it("keeps everything else and does not mutate the input", () => {
    expect(after.counts.customers).toBe(rippleResult.counts.customers);
    expect(after.nodes).toBe(rippleResult.nodes);
    expect(rippleResult.conflicts[0].status).toBe("open");
    expect(() => RippleResult.parse(after)).not.toThrow();
  });
});
