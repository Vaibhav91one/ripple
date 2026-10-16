import { expect, test } from "vitest";
import { cssEase, duration, sec, stagger } from "./motion";

test("motion constants", () => {
  expect(duration).toMatchObject({ hover: 120, enter: 220, drawer: 240, count: 300 });
  expect(stagger).toEqual({ hop: 140, card: 40 });
  expect(cssEase.enter).toBe("cubic-bezier(0.2,0,0,1)");
  expect(cssEase.exit).toBe("cubic-bezier(0.4,0,1,1)");
  expect(sec(220)).toBe(0.22);
});
