"use client";
// Body-map section of a phone screen: segmented control, front/back figures filled by state, filter chips and a detail card.
import { Info, PersonStanding, SlidersHorizontal, X } from "lucide-react";
import type { Figure, Region, RegionState } from "./body";

const FILL: Record<RegionState, string> = { good: "fill-covered", warn: "fill-gap", info: "fill-[var(--chart)]", dim: "fill-hairline" };
const CELL: Record<RegionState, string> = { good: "bg-covered", warn: "bg-gap", info: "bg-[var(--chart)]", dim: "bg-hairline" };

export interface HeatCard {
  title: string; done: number; of: string; right: string;
  /** Total cells in the bar, how many are filled and in which colour. Cells from `zoneAt` on are tinted yellow. */
  cells: number; filled: RegionState; zoneAt?: number;
}

function Shape({ region, dim }: { region: Region; dim: boolean }) {
  const s = region.shape;
  const cls = `${FILL[region.state]} stroke-page transition-opacity ${dim ? "opacity-30" : ""}`;
  return s.t === "e" ? (
    <ellipse cx={s.cx} cy={s.cy} rx={s.rx} ry={s.ry} transform={s.rot ? `rotate(${s.rot} ${s.cx} ${s.cy})` : undefined} className={cls} strokeWidth={1.5} />
  ) : (
    <rect x={s.x} y={s.y} width={s.w} height={s.h} rx={s.r} className={cls} strokeWidth={1.5} />
  );
}

export function TeamHeatMap({ tabs, tab, figures, chips, activeChip, onChip, card, focus = null, label }: {
  tabs: [string, string]; tab: string; figures: Figure[];
  chips: { id: string; label: string }[]; activeChip: string; onChip?: (id: string) => void;
  card: HeatCard;
  /** Region id (or prefix) kept at full strength; every other region fades. Null shows all. */
  focus?: string | null;
  label: string;
}) {
  const circle = "flex size-7 shrink-0 items-center justify-center rounded-full bg-raised text-body";
  const two = figures.length > 1;
  return (
    <section aria-label={label} className="mx-auto w-[300px] overflow-hidden rounded-[var(--ref-radius)] border border-hairline bg-page text-strong">
      <div className="flex items-center justify-between px-3 pt-3">
        <span className={circle}><Info size={13} aria-hidden /></span>
        <div role="tablist" className="flex rounded-full bg-raised p-0.5 text-[11px] font-medium">
          {tabs.map((t) => (
            <span key={t} role="tab" aria-selected={t === tab} className={`rounded-full px-2.5 py-1 ${t === tab ? "bg-hairline text-strong" : "text-faint"}`}>{t}</span>
          ))}
        </div>
        <span className={circle}><X size={14} aria-hidden /></span>
      </div>
      <svg viewBox={two ? "0 0 330 290" : "0 0 200 290"} className={`mx-auto block h-[250px] w-auto ${two ? "" : "mt-2"}`} role="img" aria-label={figures.map((f) => f.name).join(" and ")}>
        {/* back figure first so the front one overlaps it */}
        {figures.map((f, i) => ({ f, i })).reverse().map(({ f, i }) => (
          <g key={f.name} transform={two && i === 1 ? "translate(130 0)" : undefined}>
            {f.regions.map((rg) => <Shape key={rg.id} region={rg} dim={!!focus && !rg.id.startsWith(focus)} />)}
            {f.regions.filter((rg) => rg.label).map((rg) => {
              const s = rg.shape;
              const [x, y] = s.t === "e" ? [s.cx, s.cy] : [s.x + s.w / 2, s.y + s.h / 2];
              return <text key={rg.id} x={x} y={y} textAnchor="middle" dominantBaseline="central" className="fill-page text-[10px] font-medium">{rg.label}</text>;
            })}
          </g>
        ))}
      </svg>
      <div className="mx-1.5 mb-1.5 rounded-[18px] bg-surface p-2.5">
        <div className="mx-auto mb-2 h-1 w-9 rounded-full bg-raised" />
        <div className="flex items-center gap-1.5">
          <div className="flex min-w-0 flex-1 gap-1.5 overflow-hidden" role="group" aria-label="Filter">
            {chips.map((c) => (
              <button key={c.id} type="button" onClick={() => onChip?.(c.id)} aria-pressed={c.id === activeChip}
                className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium outline-none focus-visible:ring-2 focus-visible:ring-ripple ${c.id === activeChip ? "bg-strong text-page" : "bg-raised text-body"}`}>
                {c.label}
              </button>
            ))}
          </div>
          <span className={circle}><SlidersHorizontal size={13} aria-hidden /></span>
        </div>
        <div className="mt-2.5 rounded-[14px] bg-raised p-3">
          <p className="text-[13px] font-semibold">{card.title}</p>
          <p className="mt-0.5 flex justify-between gap-2 text-[11px] text-faint">
            <span><span className="text-strong">{card.done}</span> {card.of}</span>
            <span>{card.right}</span>
          </p>
          <div className="mt-3 flex items-center gap-2.5">
            <PersonStanding size={26} className="shrink-0 text-faint" aria-hidden />
            <div className="flex h-6 flex-1 gap-[3px]">
              {Array.from({ length: card.cells }, (_, i) => (
                <span key={i} className={`min-w-0 flex-1 rounded-[3px] ${i < card.done ? CELL[card.filled] : card.zoneAt !== undefined && i >= card.zoneAt ? "bg-gap-soft" : "bg-covered-soft"}`} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
