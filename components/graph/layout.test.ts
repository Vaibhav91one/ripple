import { describe, expect, it } from "vitest";
import { layoutLanes } from "./layout";

describe("layoutLanes", () => {
  it("puts each lane in its own column and centres the stack on y = 0", () => {
    const p = layoutLanes([["d"], ["a", "b"], ["x", "y", "z"]], 100, 40);
    expect(p.d).toEqual({ x: 0, y: 0 });
    expect(p.a).toEqual({ x: 100, y: -20 });
    expect(p.b).toEqual({ x: 100, y: 20 });
    expect(p.x).toEqual({ x: 200, y: -40 });
    expect(p.y.y).toBe(0);
    expect(p.z.y).toBe(40);
  });

  it("skips empty lanes without moving the others", () => {
    expect(layoutLanes([["a"], [], ["b"]], 100, 40).b.x).toBe(200);
  });
});
