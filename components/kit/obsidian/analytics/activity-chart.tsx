"use client";
// Obsidian UI (obsidianui.dev) Analytics Dashboard, MIT, see ../LICENSE. Restyled to Ripple tokens; bars grow with m.div scaleY.
import type { CSSProperties } from "react";
import { m, useReducedMotion } from "motion/react";
import { cx, type Tone } from "./tone";

export type ActivityBar = {
  label: string;
  /** plain bar value; ignored when `segments` is given */
  value?: number;
  /** stacked segments, bottom first; `key` matches a legend entry */
  segments?: { key: string; value: number }[];
};

export type ActivityLegend = { key: string; label: string; tone: Tone };

const total = (b: ActivityBar) => (b.segments ? b.segments.reduce((s, x) => s + x.value, 0) : (b.value ?? 0));

function niceCeil(n: number) {
  const step = n <= 10 ? 2 : n <= 40 ? 10 : n <= 120 ? 20 : 50;
  return Math.max(step, Math.ceil(n / step) * step);
}

export function ActivityChart({
  bars,
  legend = [],
  unit = "changes",
  showLegend = true,
  className,
}: {
  bars: ActivityBar[];
  /** segment colours + labels; omit for plain single-tone bars */
  legend?: ActivityLegend[];
  /** noun for the tooltip and aria label */
  unit?: string;
  showLegend?: boolean;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const totals = bars.map(total);
  const ceil = niceCeil(Math.max(0, ...totals));
  const tone = (key: string): Tone => legend.find((l) => l.key === key)?.tone ?? "ripple";
  const summary = bars.map((b, i) => `${b.label} ${totals[i]}`).join(", ");

  return (
    <div className={cx("oa", className)}>
      {showLegend && legend.length > 0 && (
        <ul className="oa-legend" aria-label="Legend" style={{ marginBottom: 12 }}>
          {legend.map((l) => (
            <li key={l.key} data-tone={l.tone}>
              <i aria-hidden="true" />
              {l.label}
            </li>
          ))}
        </ul>
      )}
      <figure className="oa-chart" role="img" aria-label={`${unit} per period: ${summary}`}>
        <div className="oa-chart-grid" aria-hidden="true">
          {[1, 0.5, 0].map((f) => (
            <span key={f} data-value={Math.round(ceil * f)} />
          ))}
        </div>
        <ol className="oa-chart-cols" aria-hidden="true" style={{ "--cols": Math.max(1, bars.length) } as CSSProperties}>
          {bars.map((b, i) => (
            <li key={b.label} className="oa-chart-col">
              <div className="oa-bar-wrap oa-has-tip" data-tip={`${b.label} · ${totals[i]} ${unit}`} style={{ height: `${(totals[i] / ceil) * 100}%` }}>
                <m.div
                  className="oa-bar"
                  initial={reduce ? false : { scaleY: 0 }}
                  animate={{ scaleY: 1 }}
                  transition={{ duration: 0.65, ease: [0.23, 1, 0.32, 1], delay: 0.2 + i * 0.06 }}
                >
                  {b.segments ? (
                    b.segments.map((s) => (s.value ? <span key={s.key} className="oa-bar-seg" data-tone={tone(s.key)} style={{ flexGrow: s.value }} /> : null))
                  ) : (
                    <span className="oa-bar-seg" data-tone="ripple" style={{ flexGrow: 1 }} />
                  )}
                </m.div>
              </div>
              <span className="oa-chart-label">{b.label}</span>
            </li>
          ))}
        </ol>
      </figure>
    </div>
  );
}
