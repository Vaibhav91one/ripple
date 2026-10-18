import { expect, test } from "vitest";
import { cssEase, duration, sec, spring, stagger } from "./motion";

test("motion constants", () => {
  expect(duration).toMatchObject({ hover: 120, enter: 220, drawer: 240, count: 300 });
  expect(stagger).toMatchObject({ hop: 140, card: 40 });
  expect(spring.soft).toEqual({ stiffness: 320, damping: 30 });
  expect(cssEase.enter).toBe("cubic-bezier(0.2,0,0,1)");
  expect(cssEase.exit).toBe("cubic-bezier(0.23,1,0.32,1)");
  expect(cssEase.drawer).toBe("cubic-bezier(0.32,0.72,0,1)");
  expect(sec(220)).toBe(0.22);
});
