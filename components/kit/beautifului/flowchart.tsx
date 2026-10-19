// Beautiful UI Flowchart (beautifului.dev, MIT), see ./LICENSE. Source: https://www.beautifului.dev/r/flowchart.json
// Restyled to Ripple tokens, motion converted to m.*, refactored to take props (nodes, edges, selection, callbacks)
// and extended with pan/zoom on the dotted canvas. With no props it renders the original Trigger + If/Else sample.
"use client";

import "./kit.css";

import { m } from "motion/react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { duration, sec } from "@/lib/motion";

/* ─────────────────────────────────────────────────────────
 * FLOWCHART — a workflow on a dotted editor canvas.
 * Cards drag anywhere and the connector follows; the empty
 * canvas pans, the wheel zooms. Condition chips open real
 * dropdowns (same menu as the PromptBar model picker).
 * ───────────────────────────────────────────────────────── */

export type FlowTone = "neutral" | "ripple" | "conflict" | "gap" | "covered";

const TONE: Record<FlowTone, string> = {
  neutral: "var(--faint)",
  ripple: "var(--ripple)",
  conflict: "var(--conflict)",
  gap: "var(--gap)",
  covered: "var(--covered)",
};
const INK: Record<FlowTone, string> = { ...TONE, neutral: "var(--body)" };

const mix = (hue: string, pct: number, base = "var(--surface)") =>
  `color-mix(in srgb, ${hue} ${pct}%, ${base})`;

/* ── layout constants ── */
const PAD_Y = 24;
const ROW_GAP = 64;
const PILL_OFFSET = 30; // kind pill + gap above a card
const MIN_Z = 0.25;
const MOBILE_MIN_Z = 0.55;
const MAX_Z = 2;

export type FlowNode = {
  id: string;
  /** the pill above the card ("Trigger", "System", "Team") */
  kind: string;
  title?: string;
  subtitle?: string;
  /** small figure on the right of the card (a count, a status word) */
  badge?: string;
  tone?: FlowTone;
  /** centre x and top y in canvas px; nodes without y stack in order, centred */
  x?: number;
  y?: number;
  w?: number;
  icon?: React.ReactNode;
  /** fade it back (a lens or filter is elsewhere) */
  dim?: boolean;
  /** ring it (a search hit) */
  hit?: boolean;
  /** renders the if/else chip rows instead of a title (the original sample) */
  condition?: boolean;
};

export type FlowEdge = {
  id?: string;
  from: string;
  to: string;
  label?: string;
  tone?: FlowTone;
  dashed?: boolean;
  dim?: boolean;
};

const NODES: FlowNode[] = [
  {
    id: "trigger",
    kind: "Trigger",
    tone: "ripple",
    title: "New order created",
    subtitle: "Trigger when a new order is created",
    w: 300,
  },
  { id: "cond", kind: "If / Else", tone: "gap", condition: true, w: 356 },
];
const EDGES: FlowEdge[] = [{ from: "trigger", to: "cond" }];

/* estimated heights for the first paint; measured immediately after */
const EST_H: Record<string, number> = { trigger: 92, cond: 134 };

const PROPERTIES = ["flavor", "topping", "size", "scoops"];
const FLAVORS = [
  { name: "Rocky Road", tag: "Classic" },
  { name: "Mint Chip", tag: "Classic" },
  { name: "Pistachio", tag: "Seasonal" },
  { name: "Bubblegum", tag: "Retro" },
];
const TOPPINGS = [
  { name: "Brown butter bourbon brittle crunch" },
  { name: "Rainbow sprinkles" },
  { name: "Hot fudge" },
  { name: "Candied pecans" },
];

/* ── icons ── */
function ConeIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="m7 11 4.08 10.35a1 1 0 0 0 1.84 0L17 11" />
      <path d="M17 7A5 5 0 0 0 7 7" />
      <path d="M17 7a2 2 0 0 1 0 4H7a2 2 0 0 1 0-4" />
    </svg>
  );
}

function Chevron() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-faint">
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function Handle() {
  return (
    <svg width="10" height="16" viewBox="0 0 10 16" className="shrink-0 cursor-grab text-faint/70">
      {[3, 8, 13].flatMap((y) => [
        <circle key={`l${y}`} cx="3" cy={y} r="1.1" fill="currentColor" />,
        <circle key={`r${y}`} cx="7.5" cy={y} r="1.1" fill="currentColor" />,
      ])}
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}

/* ── dropdown menu — same pattern as the PromptBar model picker ── */
function Menu({
  items,
  value,
  width,
  align,
  onPick,
}: {
  items: { name: string; tag?: string }[];
  value: string;
  width: string;
  align: "left" | "right";
  onPick: (name: string) => void;
}) {
  const [hovered, setHovered] = useState<number | null>(null);
  const rowRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [box, setBox] = useState<{ top: number; height: number } | null>(null);

  const valueIndex = items.findIndex((item) => item.name === value);
  useLayoutEffect(() => {
    const row = rowRefs.current[hovered ?? valueIndex];
    if (row) setBox({ top: row.offsetTop, height: row.offsetHeight });
  }, [hovered, valueIndex]);

  return (
    <div
      onMouseLeave={() => setHovered(null)}
      className={`absolute bottom-full z-20 mb-1.5 rounded-control bg-surface p-1 shadow-[var(--kit-shadow-raised)] ${width}
        ${align === "right" ? "right-0" : "left-0"}`}
      style={{
        animation: "pop-in 180ms cubic-bezier(0.23,1,0.32,1) both",
        transformOrigin: align === "right" ? "bottom right" : "bottom left",
      }}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-1 rounded-chip bg-raised"
        style={{
          top: box?.top ?? 0,
          height: box?.height ?? 0,
          opacity: box && hovered !== null ? 1 : 0,
          transition:
            "top 220ms cubic-bezier(0.23,1,0.32,1), height 220ms cubic-bezier(0.23,1,0.32,1), opacity 150ms ease",
        }}
      />
      {items.map((item, i) => (
        <button
          key={item.name}
          type="button"
          ref={(el) => {
            rowRefs.current[i] = el;
          }}
          onMouseEnter={() => setHovered(i)}
          onClick={() => onPick(item.name)}
          className="relative z-10 flex h-7.5 w-full cursor-pointer items-center gap-2 rounded-chip px-2 text-left"
        >
          <span className="min-w-0 flex-1 truncate text-sm font-medium text-strong">{item.name}</span>
          {item.tag && <span className="shrink-0 text-2xs text-faint">{item.tag}</span>}
          <span className={`shrink-0 text-strong ${item.name === value ? "" : "invisible"}`}>
            <CheckIcon />
          </span>
        </button>
      ))}
    </div>
  );
}

/* ── chips used inside the condition card ── */
function SourceChip() {
  return (
    <span
      data-ui
      className="inline-flex h-6 shrink-0 items-center gap-1 rounded-chip bg-surface px-1.5 text-xs font-medium text-strong shadow-[var(--kit-shadow-btn)]"
    >
      <span className="text-body">
        <ConeIcon size={12} />
      </span>
      order
    </span>
  );
}

function SelectChip({
  id,
  value,
  dot,
  items,
  width,
  align = "left",
  open,
  onToggle,
  onPick,
}: {
  id: string;
  value: string;
  dot?: boolean;
  items: { name: string; tag?: string }[];
  width: string;
  align?: "left" | "right";
  open: boolean;
  onToggle: (id: string) => void;
  onPick: (id: string, name: string) => void;
}) {
  return (
    <span data-ui className="relative inline-flex min-w-0">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => onToggle(id)}
        className={`inline-flex h-6 min-w-0 cursor-pointer items-center gap-1 rounded-chip px-1.5
          text-xs font-medium text-strong transition-colors duration-100 hover:bg-hairline
          ${open ? "bg-hairline" : "bg-raised"}`}
      >
        {dot && <span className="size-1.5 shrink-0 rounded-full bg-gap" />}
        <span className="min-w-0 truncate">{value}</span>
        <Chevron />
      </button>
      {open && <Menu items={items} value={value} width={width} align={align} onPick={(name) => onPick(id, name)} />}
    </span>
  );
}

function ConditionBody() {
  const [values, setValues] = useState<Record<string, string>>({
    prop1: "flavor",
    val1: "Rocky Road",
    prop2: "topping",
    val2: "Brown butter bourbon brittle crunch",
  });
  const [open, setOpen] = useState<string | null>(null);

  /* click anywhere else closes the menu */
  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => {
      if (!(event.target as Element).closest("[data-ui]")) setOpen(null);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);

  const toggle = (id: string) => setOpen((current) => (current === id ? null : id));
  const pick = (id: string, name: string) => {
    setValues((current) => ({ ...current, [id]: name }));
    setOpen(null);
  };

  const chip = (id: string, items: { name: string; tag?: string }[], width: string, extra?: object) => (
    <SelectChip id={id} value={values[id]} items={items} width={width} open={open === id} onToggle={toggle} onPick={pick} {...extra} />
  );

  return (
    <div className="flex flex-col gap-1.5 px-3 py-2.5">
      <div className="flex min-w-0 items-center gap-1.5">
        <Handle />
        <span className="w-7 text-sm text-body">If</span>
        <SourceChip />
        {chip("prop1", PROPERTIES.map((name) => ({ name })), "w-36")}
        <span className="text-sm text-body">is</span>
        {chip("val1", FLAVORS, "w-44", { dot: true, align: "right" })}
      </div>
      <div className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1.5">
        <Handle />
        <span className="w-7 text-sm text-body">and</span>
        <SourceChip />
        {chip("prop2", PROPERTIES.map((name) => ({ name })), "w-36")}
        <span className="text-sm text-body">is</span>
        <span className="max-w-full pl-[49px]">{chip("val2", TOPPINGS, "w-64", { dot: true })}</span>
      </div>
    </div>
  );
}

function StepBody({ node }: { node: FlowNode }) {
  const tone = node.tone ?? "neutral";
  return (
    <div className="flex items-center gap-2.5 p-2.5">
      <span
        className="flex size-9 shrink-0 items-center justify-center rounded-xl"
        style={{ background: mix(TONE[tone], 12), color: INK[tone], boxShadow: `0 0 0 1px ${mix(TONE[tone], 20)}` }}
      >
        {node.icon ?? <ConeIcon />}
      </span>
      <span className="min-w-0 flex-1 text-left">
        <span className="block truncate text-sm font-semibold leading-tight text-strong">{node.title}</span>
        {node.subtitle && <span className="mt-0.5 block truncate text-xs leading-snug text-body">{node.subtitle}</span>}
      </span>
      {node.badge && (
        <span
          className="shrink-0 rounded-chip px-1.5 py-0.5 font-mono text-2xs font-medium"
          style={{ background: mix(TONE[tone], 14, "var(--surface)"), color: INK[tone] }}
        >
          {node.badge}
        </span>
      )}
    </div>
  );
}

type View = { x: number; y: number; z: number };
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

/* ── the canvas ── */
export default function Flowchart({
  nodes: steps = NODES,
  edges = EDGES,
  selectedId,
  onNodeClick,
  direction = "down",
  fill = false,
  fitKey,
  insets,
  className = "",
}: {
  nodes?: FlowNode[];
  edges?: FlowEdge[];
  /** controlled selection; leave undefined and the chart keeps its own */
  selectedId?: string | null;
  onNodeClick?: (id: string) => void;
  /** which sides connectors leave and enter: bottom to top, or right to left */
  direction?: "down" | "right";
  /** fill the parent's height, fit the content on load and enable wheel zoom */
  fill?: boolean;
  /** change it to re-fit the view (a new decision, a filter) */
  fitKey?: string;
  /** px kept clear when fitting (floating toolbars) */
  insets?: { top?: number; bottom?: number; right?: number };
  className?: string;
} = {}) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const nodeRefs = useRef(new Map<string, HTMLElement>());
  const observer = useRef<ResizeObserver | null>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [heights, setHeights] = useState<Record<string, number>>(EST_H);
  const [own, setOwn] = useState<string | null>(null);
  const selected = selectedId === undefined ? own : selectedId;
  const [offsets, setOffsets] = useState<Record<string, { dx: number; dy: number }>>({});
  const [view, setView] = useState<View>({ x: 0, y: 0, z: 1 });
  const autoFit = useRef(true);
  const drag = useRef<{ id: string; startX: number; startY: number; baseDx: number; baseDy: number; moved: boolean } | null>(null);
  const pan = useRef<{ x: number; y: number; vx: number; vy: number } | null>(null);
  const viewRef = useRef(view);
  viewRef.current = view;

  const measure = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setSize((s) => (s.w === canvas.clientWidth && s.h === canvas.clientHeight ? s : { w: canvas.clientWidth, h: canvas.clientHeight }));
    setHeights((prev) => {
      const next = { ...prev };
      let changed = false;
      nodeRefs.current.forEach((el, id) => {
        const h = el.offsetHeight;
        if (h && Math.abs(h - (next[id] ?? 0)) > 0.5) {
          next[id] = h;
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, []);

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const obs = new ResizeObserver(measure);
    observer.current = obs;
    obs.observe(canvas);
    nodeRefs.current.forEach((el) => obs.observe(el));
    measure();
    return () => {
      obs.disconnect();
      observer.current = null;
    };
  }, [measure]);

  /* stack the nodes that have no y of their own, centred */
  const cw = size.w || 480;
  let cursor = PAD_Y;
  const placed = steps.map((n) => {
    const h = heights[n.id] ?? 90;
    const w = Math.min(n.w ?? 300, fill ? 600 : cw * 0.92);
    let top = n.y;
    if (top === undefined) {
      top = cursor;
      cursor += h + ROW_GAP;
    }
    const off = offsets[n.id];
    return { n, w, h, cx: (n.x ?? cw / 2) + (off?.dx ?? 0), top: top + (off?.dy ?? 0), baseCx: n.x ?? cw / 2, baseTop: top };
  });
  const byId = new Map(placed.map((p) => [p.n.id, p]));
  const canvasH = Math.max(cursor - ROW_GAP + PAD_Y, 1);

  /* card anchor points (pills sit above the card, so offset the top) */
  const anchor = (p: (typeof placed)[number], toward: number) => {
    if (direction === "right") {
      const mid = p.top + PILL_OFFSET + (p.h - PILL_OFFSET) / 2;
      const right = toward >= p.cx;
      return { x: p.cx + (right ? p.w / 2 : -p.w / 2), y: mid, dx: right ? 1 : -1, dy: 0 };
    }
    const below = toward >= p.top;
    return { x: p.cx, y: below ? p.top + p.h : p.top + PILL_OFFSET, dx: 0, dy: below ? 1 : -1 };
  };

  const geometry = (edge: FlowEdge) => {
    const a = byId.get(edge.from);
    const b = byId.get(edge.to);
    if (!a || !b) return null;
    const horiz = direction === "right";
    const from = anchor(a, horiz ? b.cx : b.top);
    const to = anchor(b, horiz ? a.cx : a.top);
    const span = horiz ? Math.abs(to.x - from.x) : Math.abs(to.y - from.y);
    const k = Math.min(Math.max(span * 0.55, 24), 120);
    const d = `M ${from.x} ${from.y} C ${from.x + from.dx * k} ${from.y + from.dy * k}, ${to.x + to.dx * k} ${to.y + to.dy * k}, ${to.x} ${to.y}`;
    /* label near the source end, so connectors fanning into one card keep their labels apart */
    const t = 0.38, u = 1 - t;
    const pt = (a: number, b: number, c: number, e: number) => u ** 3 * a + 3 * u * u * t * b + 3 * u * t * t * c + t ** 3 * e;
    return {
      d,
      mx: pt(from.x, from.x + from.dx * k, to.x + to.dx * k, to.x),
      my: pt(from.y, from.y + from.dy * k, to.y + to.dy * k, to.y),
    };
  };

  /* ── pan / zoom ── */
  /* on a phone-width canvas, never shrink cards below a readable size: pan instead (a filled canvas is touch-action:
     none, so a one-finger drag pans it; the page scrolls from outside the fixed-height canvas) */
  const minZ = size.w && size.w < 640 ? MOBILE_MIN_Z : MIN_Z;
  const layoutSig = placed.map((p) => `${p.n.id}${p.cx}${p.top}${p.h}`).join();
  const fit = useCallback(() => {
    if (!size.w || !size.h || !placed.length) return;
    const x0 = Math.min(...placed.map((p) => p.cx - p.w / 2));
    const x1 = Math.max(...placed.map((p) => p.cx + p.w / 2));
    const y0 = Math.min(...placed.map((p) => p.top));
    const y1 = Math.max(...placed.map((p) => p.top + p.h));
    const top = insets?.top ?? 60, bottom = insets?.bottom ?? 60, right = insets?.right ?? 0;
    const z = clamp(Math.min((size.w - right - 80) / (x1 - x0), (size.h - top - bottom) / (y1 - y0), 1), minZ, MAX_Z);
    /* too wide even at the minimum zoom: start at the left edge (the decision), the rest pans in */
    const wide = (x1 - x0) * z > size.w - right - 32;
    setView({ z, x: wide ? 16 - x0 * z : (size.w - right) / 2 - ((x0 + x1) / 2) * z, y: top + (size.h - top - bottom) / 2 - ((y0 + y1) / 2) * z });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size.w, size.h, minZ, layoutSig, insets?.top, insets?.bottom, insets?.right]);

  useEffect(() => {
    autoFit.current = true;
  }, [fitKey]);
  useEffect(() => {
    if (fill && autoFit.current) fit();
  }, [fill, fit, fitKey]);

  const zoomAt = (factor: number, px = size.w / 2, py = size.h / 2) => {
    autoFit.current = false;
    setView((v) => {
      const z = clamp(v.z * factor, minZ, MAX_Z);
      return { z, x: px - (px - v.x) * (z / v.z), y: py - (py - v.y) * (z / v.z) };
    });
  };

  useEffect(() => {
    const el = canvasRef.current;
    if (!el || !fill) return;
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      zoomAt(Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0015)), e.clientX - r.left, e.clientY - r.top);
    };
    el.addEventListener("wheel", wheel, { passive: false });
    return () => el.removeEventListener("wheel", wheel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fill, size.w, size.h]);

  const onCanvasDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if ((event.target as Element).closest("[data-node],[data-ui]")) return;
    pan.current = { x: event.clientX, y: event.clientY, vx: view.x, vy: view.y };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const onCanvasMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const p = pan.current;
    if (!p) return;
    autoFit.current = false;
    setView((v) => ({ ...v, x: p.vx + event.clientX - p.x, y: p.vy + event.clientY - p.y }));
  };

  /* ── dragging a card ── */
  const onPointerDown = (id: string) => (event: React.PointerEvent<HTMLDivElement>) => {
    if ((event.target as Element).closest("[data-ui]")) return;
    const off = offsets[id];
    drag.current = { id, startX: event.clientX, startY: event.clientY, baseDx: off?.dx ?? 0, baseDy: off?.dy ?? 0, moved: false };
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  };

  const onPointerMove = (id: string) => (event: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.id !== id) return;
    const z = viewRef.current.z;
    const dx = d.baseDx + (event.clientX - d.startX) / z;
    const dy = d.baseDy + (event.clientY - d.startY) / z;
    if (!d.moved && Math.hypot(dx - d.baseDx, dy - d.baseDy) < 3 / z) return;
    d.moved = true;
    setOffsets((current) => ({ ...current, [id]: { dx, dy } }));
  };

  /* The card holds pointer capture while pressed, so the browser retargets the click to the wrapper and the
     button's onClick never fires for a mouse. Select here instead, unless the press turned into a drag. */
  const select = (id: string) => {
    if (selectedId === undefined) setOwn((cur) => (cur === id ? null : id));
    onNodeClick?.(id);
  };
  const onPointerUp = (id: string) => (event: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (d?.id !== id) return;
    drag.current = null;
    if (!d.moved && event.button === 0 && !(event.target as Element).closest("[data-ui]")) select(id);
  };
  const lit = (edge: FlowEdge) => selected != null && (selected === edge.from || selected === edge.to);

  return (
    <div
      ref={canvasRef}
      onPointerDown={onCanvasDown}
      onPointerMove={onCanvasMove}
      onPointerUp={() => (pan.current = null)}
      onPointerCancel={() => (pan.current = null)}
      className={`relative w-full select-none overflow-hidden rounded-xl bg-page shadow-[var(--kit-shadow-hairline)] ${fill ? "h-full touch-none cursor-grab active:cursor-grabbing" : ""} ${className}`}
      style={{
        height: fill ? undefined : canvasH,
        backgroundImage: "radial-gradient(color-mix(in oklab, var(--faint) 38%, transparent) 1px, transparent 1.25px)",
        backgroundSize: `${22 * view.z}px ${22 * view.z}px`,
        backgroundPosition: `${view.x}px ${view.y}px`,
      }}
    >
      <div className="absolute left-0 top-0 origin-top-left" style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.z})` }}>
        {/* connectors */}
        <svg width="1" height="1" className="pointer-events-none absolute left-0 top-0 overflow-visible">
          {edges.map((edge, i) => {
            const g = geometry(edge);
            if (!g) return null;
            const tone = edge.tone ?? "neutral";
            const on = lit(edge) && tone === "neutral";
            return (
              <m.path
                key={edge.id ?? `${edge.from}-${edge.to}-${i}`}
                d={g.d}
                fill="none"
                stroke={on ? TONE.ripple : tone === "neutral" ? mix(TONE.neutral, 55, "transparent") : TONE[tone]}
                strokeWidth={tone === "neutral" ? 1.25 : 1.75}
                strokeDasharray={edge.dashed ? "5 5" : undefined}
                initial={{ opacity: 0 }}
                animate={{ opacity: edge.dim ? 0.12 : 1 }}
                transition={{ duration: sec(duration.node) }}
              />
            );
          })}
        </svg>

        {/* nodes */}
        {placed.map(({ n, w, cx, top }) => {
          const active = selected === n.id;
          const tone = n.tone ?? "neutral";
          return (
            <m.div
              key={n.id}
              data-node
              ref={(el: HTMLDivElement | null) => {
                if (el) {
                  nodeRefs.current.set(n.id, el);
                  observer.current?.observe(el);
                } else {
                  const old = nodeRefs.current.get(n.id);
                  if (old) observer.current?.unobserve(old);
                  nodeRefs.current.delete(n.id);
                }
              }}
              onPointerDown={onPointerDown(n.id)}
              onPointerMove={onPointerMove(n.id)}
              onPointerUp={onPointerUp(n.id)}
              onPointerCancel={() => (drag.current = null)}
              className="absolute flex touch-none flex-col items-start gap-1.5"
              style={{ left: cx, top, width: w, x: "-50%", zIndex: drag.current?.id === n.id ? 2 : 1 }}
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: n.dim ? 0.3 : 1, scale: 1 }}
              transition={{ duration: sec(duration.node) }}
            >
              <span
                className="inline-flex h-6 items-center rounded-chip px-2 text-xs font-medium"
                style={{ background: mix(TONE[tone], 14, "var(--page)"), color: mix(INK[tone], 80, "var(--strong)") }}
              >
                {n.kind}
              </span>
              {n.condition ? (
                <div className="w-full rounded-card bg-surface shadow-[var(--kit-shadow-card)] transition-shadow duration-150 hover:shadow-[var(--kit-shadow-raised)]">
                  <ConditionBody />
                </div>
              ) : (
                <button
                  type="button"
                  onClick={(e) => {
                    /* keyboard (Enter / Space) only: pointer presses select on pointerup above */
                    if (e.detail === 0) select(n.id);
                  }}
                  aria-pressed={active}
                  className={`w-full cursor-pointer rounded-card bg-surface text-left outline-none transition-shadow duration-150
                    focus-visible:shadow-[0_0_0_1.5px_var(--ripple)] ${
                      active
                        ? "shadow-[0_0_0_1.5px_var(--ripple),0_2px_10px_color-mix(in_oklab,var(--page)_30%,transparent)]"
                        : n.hit
                          ? "shadow-[0_0_0_1.5px_var(--ripple),0_0_0_5px_var(--ripple-soft)]"
                          : tone === "neutral" || tone === "ripple"
                            ? "shadow-[var(--kit-shadow-card)] hover:shadow-[var(--kit-shadow-raised)]"
                            : "hover:shadow-[var(--kit-shadow-raised)]"
                    }`}
                  style={tone === "neutral" || tone === "ripple" || active || n.hit ? undefined : { boxShadow: `0 0 0 1.5px ${mix(TONE[tone], 60, "transparent")}` }}
                >
                  <StepBody node={n} />
                </button>
              )}
            </m.div>
          );
        })}
        {/* edge labels */}
        {edges.map((edge, i) => {
          const g = edge.label ? geometry(edge) : null;
          if (!g) return null;
          const tone = edge.tone ?? "neutral";
          return (
            <m.span
              key={`l-${edge.id ?? `${edge.from}-${edge.to}-${i}`}`}
              className="pointer-events-none absolute whitespace-nowrap rounded-md bg-page px-1.5 py-px font-mono text-3xs font-medium shadow-[var(--kit-shadow-hairline)]"
              style={{ left: g.mx, top: g.my, x: "-50%", y: "-50%", color: tone === "neutral" ? "var(--faint)" : TONE[tone] }}
              initial={{ opacity: 0 }}
              animate={{ opacity: edge.dim ? 0.12 : 1 }}
              transition={{ duration: sec(duration.node) }}
            >
              {edge.label}
            </m.span>
          );
        })}
      </div>

      {fill && (
        <div data-ui className="absolute bottom-3 left-3 flex flex-col overflow-hidden rounded-xl bg-surface shadow-[var(--kit-shadow-card)]">
          {([["+", "Zoom in", () => zoomAt(1.25)], ["−", "Zoom out", () => zoomAt(0.8)], ["⤢", "Fit to screen", () => { autoFit.current = true; fit(); }]] as const).map(([glyph, label, run]) => (
            <button
              key={label}
              type="button"
              aria-label={label}
              onClick={run}
              className="flex size-8 items-center justify-center text-sm text-body transition-colors hover:bg-raised hover:text-strong focus-visible:outline-2 focus-visible:outline-ripple"
            >
              {glyph}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
