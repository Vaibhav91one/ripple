"use client";

// The graph view, drawn by FalkorDB's own <falkordb-canvas> web component, styled like Obsidian's graph:
// small dots sized by degree, the label beside the dot, thin light links, hover lights a node and its neighbours.
// The web component touches window at import time, so it is imported in an effect and this file exports a
// next/dynamic (ssr: false) wrapper. Colours are read from the CSS tokens at runtime.
import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState, type HTMLAttributes } from "react";
import type { FalkorDBCanvas, GraphLink, GraphNode } from "@falkordb/canvas";
import type { GraphView } from "@/lib/graph/view";
import { neighbourhood, toCanvas, type CanvasGraph, type CNode, type Role } from "./canvas";

declare module "react" {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace JSX {
    interface IntrinsicElements {
      "falkordb-canvas": HTMLAttributes<HTMLElement> & { ref?: React.Ref<FalkorDBCanvas> };
    }
  }
}

export type RippleGraphProps = {
  view: GraphView;
  /** CSS height of the canvas box, e.g. 360 or "100%" */
  height?: number | string;
  /** string id of the selected node (ringed) */
  selected?: string | null;
  /** string id to centre on and light up with its neighbours (search) */
  focus?: string | null;
  onPick?: (id: string | null) => void;
  className?: string;
  label?: string;
};

type Palette = Record<Role, string> & { link: string; strong: string; faint: string; page: string; font: string };
const DIM = 0.1;
const LABEL_PX = 11;

function readPalette(): Palette {
  const css = getComputedStyle(document.documentElement);
  const v = (n: string) => css.getPropertyValue(`--${n}`).trim();
  return {
    ripple: v("ripple"), gap: v("gap"), conflict: v("conflict"), neutral: v("faint"),
    link: v("faint"), strong: v("strong"), faint: v("faint"), page: v("page"),
    font: getComputedStyle(document.body).fontFamily || "sans-serif",
  };
}

/** Screen pixels per world unit at the current zoom (the transform also carries devicePixelRatio). */
const nodeDegree = (n: GraphNode) => (n.data as unknown as CNode).degree;
const scaleOf = (ctx: CanvasRenderingContext2D) => ctx.getTransform().a / (window.devicePixelRatio || 1);

function Inner({ view, height = 360, selected = null, focus = null, onPick, className = "", label = "Graph" }: RippleGraphProps) {
  const box = useRef<HTMLDivElement>(null);
  const el = useRef<FalkorDBCanvas>(null);
  const [state, setState] = useState<"loading" | "ready" | "failed">("loading");
  const g: CanvasGraph = useMemo(() => toCanvas(view), [view]);

  // everything the draw callbacks read lives in refs, so a hover never re-renders React
  const live = useRef({ g, hover: null as number | null, focus: null as number | null, selected: null as number | null, lit: null as Set<number> | null, pick: onPick, fitted: false });
  useEffect(() => {
    live.current.g = g;
    live.current.pick = onPick;
  }, [g, onPick]);
  const keyToId = useMemo(() => new Map(g.nodes.map((n) => [n.key, n.id])), [g]);

  const relight = () => {
    const s = live.current;
    const c = s.hover ?? s.focus;
    s.lit = c === null ? null : neighbourhood(s.g, c);
    (el.current as unknown as { triggerRender?: () => void } | null)?.triggerRender?.();
  };

  useEffect(() => {
    let off = false;
    import("@falkordb/canvas")
      .then(() => !off && setState(customElements.get("falkordb-canvas") ? "ready" : "failed"))
      .catch(() => !off && setState("failed"));
    return () => {
      off = true;
    };
  }, []);

  // config once the element exists
  useEffect(() => {
    const c = el.current;
    if (state !== "ready" || !c || !box.current) return;
    const p = readPalette();
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const colour = (r: Role) => p[r];
    const s = live.current;
    const nodeOf = (n: GraphNode) => n.data as unknown as CNode;

    c.setConfig({
      width: box.current.clientWidth,
      height: box.current.clientHeight,
      backgroundColor: p.page,
      foregroundColor: p.strong,
      captionsKeys: ["title"],
      animation: !reduced,
      // airy: weak repulsion for small dots; reduced motion settles off-screen and stops almost at once
      simulation: { chargeStrength: -110, centerStrength: 0.05, velocityDecay: 0.35, alphaMin: reduced ? 0.3 : 0.02, warmupTicks: reduced ? 300 : 40 },
      node: {
        nodeCanvasObject: (n, ctx) => {
          if (n.x === undefined || n.y === undefined) return;
          const d = nodeOf(n), k = scaleOf(ctx), r = d.size;
          const on = !s.lit || s.lit.has(n.id);
          ctx.globalAlpha = on ? 1 : DIM;
          ctx.beginPath();
          ctx.arc(n.x, n.y, r, 0, 2 * Math.PI);
          ctx.fillStyle = colour(d.role);
          ctx.fill();
          if (s.selected === n.id || s.hover === n.id) {
            ctx.lineWidth = 1.5 / k;
            ctx.strokeStyle = p.strong;
            ctx.beginPath();
            ctx.arc(n.x, n.y, r + 2.5 / k, 0, 2 * Math.PI);
            ctx.stroke();
          }
          // labels fade in with zoom, like Obsidian; hubs, status nodes and the lit neighbourhood always show theirs
          const always = d.degree >= 4 || d.role !== "neutral" || (s.lit?.has(n.id) ?? false) || s.selected === n.id;
          const a = always ? 1 : Math.max(0, Math.min(1, (k - 1.1) / 0.6));
          if (a > 0 && on) {
            ctx.globalAlpha = a;
            const hot = s.hover === n.id || s.focus === n.id || s.selected === n.id;
            ctx.font = `${hot ? 500 : 400} ${LABEL_PX / k}px ${p.font}`;
            ctx.textAlign = "left";
            ctx.textBaseline = "middle";
            ctx.fillStyle = hot ? p.strong : p.faint;
            const t = d.title.length > 32 ? `${d.title.slice(0, 31)}…` : d.title;
            ctx.fillText(t, n.x + r + 4 / k, n.y);
          }
          ctx.globalAlpha = 1;
        },
        nodePointerAreaPaint: (n, color, ctx) => {
          if (n.x === undefined || n.y === undefined) return;
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.arc(n.x, n.y, nodeOf(n).size + 4 / scaleOf(ctx), 0, 2 * Math.PI);
          ctx.fill();
        },
      },
      link: {
        linkCanvasObject: (l: GraphLink, ctx, scale) => {
          const a = l.source, b = l.target;
          if (a.x === undefined || a.y === undefined || b.x === undefined || b.y === undefined) return;
          const role = (l.data as { role?: Role } | undefined)?.role ?? "neutral";
          const c0 = s.hover ?? s.focus;
          const touching = c0 !== null && (a.id === c0 || b.id === c0);
          ctx.globalAlpha = c0 === null ? (role === "conflict" ? 0.7 : 0.26) : touching ? 0.85 : DIM / 2;
          ctx.strokeStyle = role === "conflict" ? p.conflict : touching ? p.strong : p.link;
          ctx.lineWidth = (touching ? 1.1 : 0.6) / scale;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
          ctx.globalAlpha = 1;
        },
        linkPointerAreaPaint: () => {}, // links are not interactive
      },
      eventHandlers: {
        onNodeHover: (n) => {
          s.hover = n?.id ?? null;
          if (box.current) box.current.style.cursor = n ? "pointer" : "";
          relight();
        },
        onNodeClick: (n) => s.pick?.(nodeOf(n).key),
        onBackgroundClick: () => s.pick?.(null),
        onEngineStop: () => {
          if (s.fitted) return;
          s.fitted = true;
          c.zoomToFit(1);
          // a search that arrived with the URL (?q=) could not centre before the layout existed
          const f = s.focus === null ? undefined : c.getGraphData().nodes.find((x) => x.id === s.focus);
          if (f?.x !== undefined && f.y !== undefined) setTimeout(() => c.centerAt(f.x!, f.y!, 500), 600);
        },
      },
    });
    const ro = new ResizeObserver(([e]) => {
      c.setWidth(Math.round(e.contentRect.width));
      c.setHeight(Math.round(e.contentRect.height));
    });
    ro.observe(box.current);
    return () => ro.disconnect();
  }, [state]);

  // data
  useEffect(() => {
    const c = el.current;
    if (state !== "ready" || !c) return;
    const p = readPalette();
    live.current.fitted = false;
    c.setData({
      nodes: g.nodes.map((n) => ({ id: n.id, labels: [n.kind], color: p[n.role], visible: true, size: n.size, data: n as unknown as Record<string, unknown> })),
      links: g.links.map((l) => ({ id: l.id, relationship: l.type, color: p.link, source: l.source, target: l.target, visible: true, data: { role: l.role } })),
    });
    // force-graph never stops on its own here (cooldown is Infinity): settle within a few seconds, then fit.
    // Reduced motion runs without animation (the layout is computed off-screen and shown settled).
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const fg = c.getGraph();
    fg?.nodeLabel(() => "").d3AlphaMin(0.02).cooldownTime(reduced ? 300 : 4000); // label beside the dot, no tooltip
    // Obsidian spacing: cluster items huddle around their cluster, the core keeps room for its labels
    type Force = { distance?: (f: (l: GraphLink) => number) => void; strength?: (v: number | ((n: GraphNode) => number)) => void };
    (fg?.d3Force("link") as Force | undefined)?.distance?.((l) => (l.relationship === "IN" ? 16 : 55));
    (fg?.d3Force("charge") as Force | undefined)?.strength?.((n) => (nodeDegree(n) > 3 ? -260 : -60));
    if (!reduced) fg?.d3ReheatSimulation();
  }, [state, g]);

  // selection and search focus
  useEffect(() => {
    const s = live.current;
    s.selected = selected === null ? null : (keyToId.get(selected) ?? null);
    s.focus = focus === null ? null : (keyToId.get(focus) ?? null);
    relight();
    const c = el.current;
    if (s.focus === null || !c) return;
    const n = c.getGraphData().nodes.find((x) => x.id === s.focus);
    if (n?.x !== undefined && n.y !== undefined) {
      c.centerAt(n.x, n.y, 500);
      c.getGraph()?.zoom(Math.max(c.getZoom(), 2.2), 500);
    }
  }, [selected, focus, keyToId, state]);

  const h = typeof height === "number" ? `${height}px` : height;
  return (
    <div ref={box} aria-label={label} role="group" className={`relative overflow-hidden bg-page ${className}`} style={{ height: h }} data-graph-state={state}>
      {state === "failed" ? (
        <p className="grid h-full place-items-center px-6 text-center text-sm text-faint">
          The graph view could not load in this browser. {g.nodes.length} nodes and {g.links.length} links are still listed in the panels.
        </p>
      ) : (
        state === "ready" && <falkordb-canvas ref={el} style={{ display: "block", width: "100%", height: "100%" }} />
      )}
      {state === "loading" && <div className="absolute inset-0 animate-pulse bg-raised/40" aria-busy="true" aria-label="Loading the graph" />}
    </div>
  );
}

/** Client-only: the web component and force-graph need window. */
export const RippleGraph = dynamic(() => Promise.resolve(Inner), {
  ssr: false,
  loading: () => <div className="h-[360px] animate-pulse bg-raised/40" aria-busy="true" aria-label="Loading the graph" />,
});
