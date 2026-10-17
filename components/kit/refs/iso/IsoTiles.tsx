"use client";
// SVG isometric scene: real filled polygons (top, left, right faces) from the projection helper in iso.ts.
// Optional glow per tile (selected glows, related tiles glow less) via the opacity of an overlay polygon.
import type { ReactNode } from "react";
import { m, useReducedMotion } from "motion/react";
import { duration, sec } from "@/lib/motion";
import { centre, faces, flat, plane, project, pts, S, type Item, type P, type Scene, type Tone } from "./iso";

// Literal class names so Tailwind sees them. Faces sit on an opaque page-coloured underlay so links never show through.
const TONES: Record<Tone, { top: string; left: string; right: string; line: string }> = {
  base: { top: "fill-page", left: "fill-surface", right: "fill-raised", line: "stroke-hairline" },
  inset: { top: "fill-raised", left: "fill-surface", right: "fill-raised", line: "stroke-hairline" },
  dark: { top: "fill-overlay", left: "fill-overlay", right: "fill-overlay/90", line: "stroke-overlay" },
  accent: { top: "fill-ripple", left: "fill-ripple/75", right: "fill-ripple/55", line: "stroke-ripple" },
  covered: { top: "fill-covered/30", left: "fill-covered/20", right: "fill-covered/12", line: "stroke-covered/60" },
  gap: { top: "fill-gap/30", left: "fill-gap/20", right: "fill-gap/12", line: "stroke-gap/70" },
  device: { top: "fill-page", left: "fill-page", right: "fill-surface", line: "stroke-hairline" },
};

const NS = "[vector-effect:non-scaling-stroke]";

function Marks({ item }: { item: Item }) {
  const { x, y, z = 0, w, d, h, mark, screws } = item;
  const top = plane(x, y, z + h);
  return (
    <>
      {screws && (
        <g transform={top} className={`fill-none stroke-hairline ${NS}`}>
          {[[0.3, 0.3], [w - 0.3, 0.3], [w - 0.3, d - 0.3], [0.3, d - 0.3]].map(([u, v]) => (
            <circle key={`${u}${v}`} cx={u} cy={v} r={0.07} strokeWidth={1} className={NS} />
          ))}
        </g>
      )}
      {mark === "terminal" && (
        <g transform={top}>
          {[0.45, 0.75, 1.05].map((u) => <circle key={u} cx={u} cy={0.38} r={0.09} className="fill-faint" />)}
          <path d={`M0.2 0.8H${w - 0.2}`} className={`fill-none stroke-faint/50 ${NS}`} strokeWidth={1} />
          <path d="M0.75 1.35L1.2 1.75L0.75 2.15" className={`fill-none stroke-body ${NS}`} strokeWidth={1.5} />
          <rect x={1.55} y={1.45} width={0.32} height={0.62} className="fill-page" />
        </g>
      )}
      {mark === "logo" && (
        <g transform={top} className="fill-page">
          {[[0, 0], [2, 0], [1, 1], [0, 2], [2, 2]].map(([i, j]) => {
            const c = w / 6;
            return <rect key={`${i}${j}`} x={w / 2 - 1.5 * c + i * c + c * 0.05} y={d / 2 - 1.5 * c + j * c + c * 0.05} width={c * 0.9} height={c * 0.9} />;
          })}
        </g>
      )}
      {mark === "stone" && <Stone item={item} />}
    </>
  );
}

// A ball hovering above the slab with its shadow on the top face.
function Stone({ item }: { item: Item }) {
  const [cx, cy] = centre(item);
  const top = (item.z ?? 0) + item.h;
  const [sx, sy] = project(cx, cy, top + 1.3);
  return (
    <>
      <g transform={plane(cx, cy, top)}><circle r={0.6} className="fill-page/40" /></g>
      <circle cx={sx} cy={sy} r={0.5 * S} className="fill-ripple stroke-page" strokeWidth={1.5} />
    </>
  );
}

// Upright devices drawn as thin boxes standing on their slab.
function Phone({ item }: { item: Item }) {
  const [cx, cy] = centre(item);
  const f = faces({ x: cx - 0.11, y: cy - 0.4, z: (item.z ?? 0) + item.h, w: 0.22, d: 0.8, h: 1.9 });
  return (
    <g className="stroke-hairline" strokeWidth={1.25} strokeLinejoin="round">
      <polygon points={pts(f.left)} className="fill-page" />
      <polygon points={pts(f.right)} className="fill-surface" />
      <polygon points={pts(f.top)} className="fill-page" />
    </g>
  );
}
function Laptop({ item }: { item: Item }) {
  const [cx, cy] = centre(item);
  const z = (item.z ?? 0) + item.h;
  const base = faces({ x: cx - 0.8, y: cy - 0.8, z, w: 1.6, d: 1.6, h: 0.08 });
  const keys = faces({ x: cx - 0.5, y: cy - 0.6, z: z + 0.08, w: 1, d: 1.2, h: 0.03 });
  const scr = faces({ x: cx - 0.8, y: cy - 0.8, z: z + 0.08, w: 0.08, d: 1.6, h: 1.25 });
  return (
    <g className="stroke-hairline" strokeWidth={1.25} strokeLinejoin="round">
      <polygon points={pts(base.left)} className="fill-surface" />
      <polygon points={pts(base.right)} className="fill-surface" />
      <polygon points={pts(base.top)} className="fill-page" />
      <polygon points={pts(keys.top)} className="fill-overlay" />
      <polygon points={pts(scr.left)} className="fill-surface" />
      <polygon points={pts(scr.right)} className="fill-page" />
      <polygon points={pts(scr.top)} className="fill-page" />
    </g>
  );
}

function Tile({ item, glow, onHover }: { item: Item; glow: number; onHover?: (id: string | null) => void }) {
  const reduce = useReducedMotion();
  const f = faces(item);
  const t = TONES[item.tone];
  const [cx, cy] = centre(item);
  const [lx] = project(cx, cy, item.z ?? 0);
  const [, ly] = project(item.x + item.w, item.y + item.d, item.z ?? 0);
  const face = (ps: P[], cls: string) => (
    <>
      <polygon points={pts(ps)} className="fill-page" />
      <polygon points={pts(ps)} className={`${cls} ${t.line}`} strokeWidth={1.25} strokeLinejoin="round" />
    </>
  );
  const r = Math.min(0.45, Math.min(item.w, item.d) * 0.18);
  const wired = !!onHover && !!item.label;
  const body = (
    <>
      {face(f.left, t.left)}
      {face(f.right, t.right)}
      <g transform={plane(item.x, item.y, (item.z ?? 0) + item.h)}>
        <rect width={item.w} height={item.d} rx={r} className="fill-page" />
        <rect width={item.w} height={item.d} rx={r} className={`${t.top} ${t.line} ${NS}`} strokeWidth={1.25} />
        {item.screws && <rect x={0.3} y={0.3} width={item.w - 0.6} height={item.d - 0.6} rx={r * 0.7} className={`fill-none stroke-hairline ${NS}`} strokeWidth={1} />}
      </g>
      {item.mark === "phone" && <Phone item={item} />}
      {item.mark === "laptop" && <Laptop item={item} />}
      <Marks item={item} />
      {wired && (
        <m.polygon points={pts(f.top)} className="pointer-events-none fill-ripple" initial={false}
          animate={{ opacity: glow }} transition={{ duration: reduce ? 0 : sec(duration.hover) }} />
      )}
      {item.label && <text x={lx} y={ly + 18} textAnchor="middle" className="fill-faint font-mono text-[13px]">{item.label}</text>}
    </>
  );
  return wired ? (
    <g role="button" tabIndex={0} aria-label={item.label} className="cursor-pointer outline-none"
      onMouseEnter={() => onHover(item.id)} onMouseLeave={() => onHover(null)} onFocus={() => onHover(item.id)} onBlur={() => onHover(null)}>
      {body}
    </g>
  ) : <g>{body}</g>;
}

export function IsoTiles({ scene, label, active = null, related = [], onHover, grid = 3 }: {
  scene: Scene; label: string;
  /** Selected tile id: glows. */
  active?: string | null;
  /** Tiles related to the selected one: glow less. */
  related?: string[];
  /** Hover / focus handler; its presence makes labelled tiles interactive. */
  onHover?: (id: string | null) => void;
  /** Floor grid extends this many units past the scene. */
  grid?: number;
}) {
  const all = flat(scene.items);
  const byId = new Map(all.map((i) => [i.id, i]));
  const corners = all.flatMap((i) => Object.values(faces(i)).flat());
  const xs = corners.map((c) => c[0]);
  const ys = corners.map((c) => c[1]);
  const pad = 36;
  const [minX, maxX, minY, maxY] = [Math.min(...xs) - pad, Math.max(...xs) + pad, Math.min(...ys) - pad - 40, Math.max(...ys) + pad + 20];
  const x0 = Math.min(...all.map((i) => i.x)) - grid, x1 = Math.max(...all.map((i) => i.x + i.w)) + grid;
  const y0 = Math.min(...all.map((i) => i.y)) - grid, y1 = Math.max(...all.map((i) => i.y + i.d)) + grid;
  const ticks = (a: number, b: number) => Array.from({ length: Math.ceil((b - a) / 2) + 1 }, (_, k) => Math.floor(a) + k * 2);
  const route = (l: (string | P)[]) => l.flatMap((p) => {
    if (typeof p !== "string") return [project(p[0], p[1])];
    const i = byId.get(p);
    return i ? [project(...centre(i))] : [];
  });
  const depth = (i: Item) => i.x + i.y + (i.w + i.d) / 2;
  const sorted = [...scene.items].sort((a, b) => depth(a) - depth(b) || (a.z ?? 0) - (b.z ?? 0));
  const render = (i: Item): ReactNode => (
    <g key={i.id}>
      <Tile item={i} onHover={onHover} glow={active === i.id ? 0.5 : related.includes(i.id) ? 0.22 : 0} />
      {i.children?.map(render)}
    </g>
  );
  return (
    <svg viewBox={`${minX} ${minY} ${maxX - minX} ${maxY - minY}`} role="img" aria-label={label} className="h-auto w-full">
      <g className="fill-none stroke-hairline/70" strokeWidth={1}>
        {ticks(x0, x1).map((x) => <polyline key={`x${x}`} points={pts([project(x, y0), project(x, y1)])} />)}
        {ticks(y0, y1).map((y) => <polyline key={`y${y}`} points={pts([project(x0, y), project(x1, y)])} />)}
      </g>
      {scene.rings?.map((r, k) => (
        <g key={r.r} transform={plane(r.x, r.y, 0)}>
          <circle r={r.r} className={`fill-none stroke-ripple ${NS}`} strokeOpacity={0.6 - k * 0.15} strokeWidth={1.5} />
        </g>
      ))}
      {scene.links.map((l, k) => <polyline key={k} points={pts(route(l))} className="fill-none stroke-faint/70" strokeWidth={1.5} strokeDasharray="7 6" />)}
      {sorted.map(render)}
    </svg>
  );
}
