import type { Analytics } from "@/lib/schemas/analytics";
import { fmtDay, forecastPoints } from "./model";

const W = 1000;
const H = 260;
const P = (x: number, y: number) => `${(x * W).toFixed(1)},${((1 - y) * H).toFixed(1)}`;

/** Actual coverage (solid), the current path to the effective date (dashed), with approvals (green), if proposed (dotted). */
export function ForecastChart({ a, approvals, ifProposed }: { a: Analytics; approvals: number; ifProposed: number }) {
  const pts = forecastPoints(a);
  const f = a.forecast;
  if (!pts || !f) return null;
  const now = pts.x(pts.today);
  const cur = f.currentPct / 100;
  const proj = pts.projected;
  const dot = (x: number, y: number, cls: string, label: string) => (
    <span key={label} title={label} className={`absolute size-2.5 -translate-x-1/2 translate-y-1/2 rounded-full border-2 bg-surface ${cls}`} style={{ left: `${x * 100}%`, bottom: `${y * 100}%` }} />
  );
  return (
    <figure className="mt-6" aria-label={proj ? `Coverage ${f.currentPct}% today, ${f.projectedPct}% projected by ${fmtDay(pts.t1)}, ${approvals}% with approvals` : `Coverage ${f.currentPct}% today; no effective date set, so nothing is projected`}>
      <div className="relative ml-10" style={{ height: H }}>
        {[0, 25, 50, 75, 100].map((v) => (
          <div key={v} className={`absolute inset-x-0 ${v === 100 ? "border-t border-dashed border-strong/70" : "border-t border-hairline"}`} style={{ bottom: `${v}%` }}>
            <span className="absolute -left-10 -translate-y-1/2 text-2xs text-faint">{v}%</span>
            {v === 100 && <span className="absolute left-2 -top-5 text-xs font-medium text-strong">Target 100%</span>}
          </div>
        ))}
        {proj && <div className="absolute inset-y-0 right-0 rounded-r-inset bg-ripple-soft/40" style={{ left: `${now * 100}%` }} aria-hidden />}
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="absolute inset-0 size-full overflow-visible" aria-hidden>
          <polyline points={pts.actual.map(([x, y]) => P(x, y)).join(" ")} fill="none" stroke="var(--ripple)" strokeWidth={2.5} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
          {proj && <polyline points={`${P(now, cur)} ${P(1, f.projectedPct / 100)}`} fill="none" stroke="var(--ripple)" strokeWidth={2} strokeDasharray="6 5" vectorEffect="non-scaling-stroke" />}
          {proj && <polyline points={`${P(now, cur)} ${P(1, approvals / 100)}`} fill="none" stroke="var(--covered)" strokeWidth={2} strokeDasharray="6 5" vectorEffect="non-scaling-stroke" />}
          {proj && ifProposed > approvals && <polyline points={`${P(now, cur)} ${P(1, ifProposed / 100)}`} fill="none" stroke="var(--faint)" strokeWidth={2} strokeDasharray="2 4" vectorEffect="non-scaling-stroke" />}
        </svg>
        {dot(now, cur, "border-ripple", `Today ${f.currentPct}%`)}
        {proj && dot(1, f.projectedPct / 100, "border-ripple", `Current path ${f.projectedPct}%`)}
        {proj && dot(1, approvals / 100, "border-covered", `With approvals ${approvals}%`)}
        {proj && ifProposed > approvals && dot(1, ifProposed / 100, "border-faint", `If proposed ${ifProposed}%`)}
        {proj && <div className="absolute right-0 top-3 hidden rounded-full sm:block border border-hairline bg-surface px-3 py-1 text-xs shadow-sm">
          <span className="text-faint">{fmtDay(pts.t1)}</span> <span className="ml-1 font-medium text-strong">{f.projectedPct}%</span> <span className="text-faint">on the current path</span>
          <span className="ml-2 font-medium text-covered">{approvals}%</span> <span className="text-faint">with approvals</span>
          {ifProposed > approvals && <><span className="ml-2 font-medium text-strong">{ifProposed}%</span> <span className="text-faint">if proposed</span></>}
        </div>}
      </div>
      <div className="relative ml-10 mt-2 h-4 text-xs text-faint">
        <span className="absolute left-0">{fmtDay(pts.t0)}</span>
        {proj && <span className="absolute hidden -translate-x-1/2 sm:inline" style={{ left: `${now * 100}%` }}>Today</span>}
        <span className="absolute right-0">{proj ? fmtDay(pts.t1) : "Today"}</span>
      </div>
    </figure>
  );
}
