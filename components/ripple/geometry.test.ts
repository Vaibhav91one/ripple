import { expect, test } from "vitest";
import { rippleResult } from "@/lib/mock/ledgerly";
import { layout, SIZE } from "./geometry";

test("clusters per kind, all nodes inside the canvas, no two nodes overlap", () => {
  const { nodes, edges } = layout(rippleResult);
  expect(nodes.filter((n) => n.count).map((n) => n.label)).toEqual(["40 customers", "12 tickets", "3 deals", "2 contracts"]);
  expect(edges.some((e) => e.dashed)).toBe(true);
  for (const [i, a] of nodes.entries()) {
    expect(a.x - a.r).toBeGreaterThan(0);
    expect(a.x + a.r).toBeLessThan(SIZE);
    expect(a.y - a.r).toBeGreaterThan(0);
    expect(a.y + a.r).toBeLessThan(SIZE);
    for (const b of nodes.slice(i + 1)) expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThan(a.r + b.r);
  }
});
