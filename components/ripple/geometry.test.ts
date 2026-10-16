import { expect, test } from "vitest";
import { rippleResult } from "@/lib/mock/ledgerly";
import { place, SIZE } from "./geometry";

test("every ripple node gets a position inside the canvas", () => {
  const p = place(rippleResult.nodes);
  expect(p).toHaveLength(rippleResult.nodes.length);
  for (const n of p) {
    expect(n.x).toBeGreaterThan(0);
    expect(n.x).toBeLessThan(SIZE);
    expect(n.y).toBeGreaterThan(0);
    expect(n.y).toBeLessThan(SIZE);
  }
});
