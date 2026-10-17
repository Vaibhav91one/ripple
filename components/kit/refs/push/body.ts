// Body-map geometry: every region is a plain ellipse or rounded rect (no traced paths). Plain data, shared by server and client.
export type Shape =
  | { t: "e"; cx: number; cy: number; rx: number; ry: number; rot?: number }
  | { t: "r"; x: number; y: number; w: number; h: number; r?: number; rot?: number };
/** good = covered/green, warn = gap/yellow, info = blue, dim = untouched. */
export type RegionState = "good" | "warn" | "info" | "dim";
export interface Region { id: string; state: RegionState; shape: Shape; label?: string }
export interface Figure { name: string; regions: Region[] }

// Helpers for left/right pairs around the centre line x = 100 (figures are 200 wide, 280 tall).
const e = (cx: number, cy: number, rx: number, ry: number, rot = 0): Shape => ({ t: "e", cx, cy, rx, ry, rot });
const r = (x: number, y: number, w: number, h: number, rad = 3): Shape => ({ t: "r", x, y, w, h, r: rad });
const pair = (id: string, state: RegionState, cx: number, cy: number, rx: number, ry: number, rot = 0): Region[] => [
  { id: `${id}-l`, state, shape: e(100 - cx, cy, rx, ry, -rot) },
  { id: `${id}-r`, state, shape: e(100 + cx, cy, rx, ry, rot) },
];

/** Muscle map, front and back, regions filled by weekly volume. Matches Push's "Last 7 days" screen. */
export const muscleFigures: Figure[] = [
  {
    name: "Front",
    regions: [
      { id: "head", state: "dim", shape: e(100, 18, 13, 17) },
      { id: "neck", state: "dim", shape: r(94, 32, 12, 14, 4) },
      { id: "torso", state: "dim", shape: r(72, 44, 56, 112, 20) },
      ...pair("traps", "warn", 13, 47, 13, 6, 18),
      ...pair("shoulder", "info", 42, 58, 10, 14, -20),
      ...pair("chest", "good", 19, 68, 19, 17, 6),
      ...pair("biceps", "good", 51, 93, 9, 24, -8),
      ...pair("forearm", "dim", 59, 132, 7, 22, -6),
      ...pair("hand", "dim", 66, 162, 5, 10, -10),
      ...pair("oblique", "dim", 24, 110, 6, 20),
      ...[0, 1, 2, 3].flatMap((i) => [
        { id: `abs-${i}-l`, state: "warn" as const, shape: r(88, 90 + i * 15, 11, 12, 3) },
        { id: `abs-${i}-r`, state: "warn" as const, shape: r(101, 90 + i * 15, 11, 12, 3) },
      ]),
      { id: "hip", state: "warn", shape: e(100, 152, 14, 10) },
      ...pair("quad", "dim", 15, 198, 13, 38, 2),
      ...pair("calf", "dim", 16, 256, 8, 23),
    ],
  },
  {
    name: "Back",
    regions: [
      { id: "head", state: "dim", shape: e(100, 18, 13, 17) },
      { id: "neck", state: "dim", shape: r(94, 32, 12, 14, 4) },
      { id: "traps", state: "warn", shape: e(100, 62, 20, 24) },
      ...pair("rear-delt", "info", 42, 58, 10, 14, -20),
      ...pair("lat", "good", 21, 94, 15, 24, 10),
      ...pair("triceps", "good", 51, 93, 9, 24, -8),
      ...pair("forearm", "dim", 59, 132, 7, 22, -6),
      ...pair("hand", "dim", 66, 162, 5, 10, -10),
      { id: "torso", state: "dim", shape: r(80, 50, 40, 100, 16) },
      { id: "lower-back", state: "dim", shape: r(86, 118, 28, 26, 6) },
      ...pair("glute", "dim", 13, 156, 13, 13),
      ...pair("hamstring", "dim", 15, 205, 12, 32, 2),
      ...pair("calf", "dim", 16, 258, 8, 21),
    ],
  },
];

/** Ripple's "org body": seven team regions on one figure. */
export const orgFigure: Figure = {
  name: "Teams",
  regions: [
    { id: "data", state: "info", shape: e(100, 24, 20, 20), label: "Data" },
    { id: "neck", state: "dim", shape: r(93, 42, 14, 12, 4) },
    { id: "eng", state: "good", shape: r(66, 54, 68, 72, 14), label: "Eng" },
    { id: "support", state: "good", shape: r(22, 56, 40, 78, 14), label: "Support" },
    { id: "sales", state: "good", shape: r(138, 56, 40, 78, 14), label: "Sales" },
    { id: "devrel", state: "warn", shape: r(66, 132, 68, 34, 12), label: "DevRel" },
    { id: "security", state: "warn", shape: r(62, 172, 37, 98, 12), label: "Security" },
    { id: "legal", state: "warn", shape: r(101, 172, 37, 98, 12), label: "Legal" },
  ],
};
