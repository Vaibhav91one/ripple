// Isometric projection helper: world (x, y, z) to screen, 30 degree axes. x runs down-right, y down-left, z up.
export const S = 40; // px per world unit
const C = Math.cos(Math.PI / 6);
const H = Math.sin(Math.PI / 6);

export type P = [number, number];
export const project = (x: number, y: number, z = 0): P => [(x - y) * C * S, (x + y) * H * S - z * S];
/** Inverse of project at a given height: which world (x, y) lands on screen (sx, sy). */
export const unproject = (sx: number, sy: number, z = 0): P => {
  const u = sx / (C * S);
  const v = (sy + z * S) / (H * S);
  return [(u + v) / 2, (v - u) / 2];
};
export const pts = (ps: P[]) => ps.map(([a, b]) => `${a.toFixed(1)},${b.toFixed(1)}`).join(" ");
/** SVG matrix that maps a flat (u, v) plane at height z, origin (x, y), onto the screen. Draw marks in plane units. */
export const plane = (x: number, y: number, z: number) => {
  const [e, f] = project(x, y, z);
  return `matrix(${C * S} ${H * S} ${-C * S} ${H * S} ${e.toFixed(1)} ${f.toFixed(1)})`;
};

export type Tone = "base" | "inset" | "dark" | "accent" | "covered" | "gap" | "device";
export type Mark = "terminal" | "logo" | "stone" | "phone" | "laptop";
export interface Item {
  id: string; x: number; y: number; z?: number; w: number; d: number; h: number;
  tone: Tone; mark?: Mark; label?: string; screws?: boolean; children?: Item[];
}
export interface Scene {
  items: Item[];
  /** Dashed connectors: item ids, or [x, y] world points, joined in order. */
  links: (string | P)[][];
  /** Concentric ellipses spreading on the floor. */
  rings?: { x: number; y: number; r: number }[];
}

export interface Faces { top: P[]; left: P[]; right: P[] }
type Box = Pick<Item, "x" | "y" | "z" | "w" | "d" | "h">;
export const faces = ({ x, y, z = 0, w, d, h }: Box): Faces => {
  const t = z + h;
  return {
    top: [project(x, y, t), project(x + w, y, t), project(x + w, y + d, t), project(x, y + d, t)],
    left: [project(x, y + d, t), project(x + w, y + d, t), project(x + w, y + d, z), project(x, y + d, z)],
    right: [project(x + w, y, t), project(x + w, y + d, t), project(x + w, y + d, z), project(x + w, y, z)],
  };
};

/** Build a box from the screen position of its top-face centre (used to place a replica from a screenshot). */
export const at = (sx: number, sy: number, size: number | [number, number], z: number, h: number): Box => {
  const [w, d] = typeof size === "number" ? [size, size] : size;
  const [cx, cy] = unproject(sx, sy, z + h);
  return { x: cx - w / 2, y: cy - d / 2, z, w, d, h };
};

export const flat = (items: Item[]): Item[] => items.flatMap((i) => [i, ...flat(i.children ?? [])]);
export const centre = (i: Pick<Item, "x" | "y" | "w" | "d">): P => [i.x + i.w / 2, i.y + i.d / 2];
/** Ids joined to `id` by a link: the "related" set for a hover glow. */
export const neighbours = (links: Scene["links"], id: string) =>
  links.flatMap((l) => l.flatMap((p, k) => (p === id ? [l[k - 1], l[k + 1]] : []))).filter((v): v is string => typeof v === "string");
