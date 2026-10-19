import { expect, test } from "vitest";
import { layoutDots, overflowCols } from "./dot-strip";

test("dots in one column stack, others sit on the baseline, out-of-range values clamp to the ends", () => {
  expect(layoutDots([0, 0, 50, 100, 500, -9], 0, 100, 3)).toEqual([[0, 0], [0, 1], [50, 0], [100, 0], [100, 1], [0, 2]]);
});

test("a crowded column caps at maxRows and reports the rest as +N", () => {
  const pos = layoutDots(Array(12).fill(100).concat([0]), 0, 100, 3);
  expect(overflowCols(pos, 8)).toEqual([[100, 4]]);
});
