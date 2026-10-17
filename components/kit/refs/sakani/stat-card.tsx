// SakaniUI (sakaniui.com), MIT, see ./LICENSE. Restyled to Ripple tokens.
// Ported from SakaniUI StatCard (head / value / meta structure, 14px muted title, 30px value, delta Badge + description);
// padding, radius and delta pill sizes follow the CRM dashboard screenshot.
import { Minus, TrendingDown, TrendingUp } from "lucide-react";

export type StatTrend = "up" | "down" | "flat";

const tone: Record<StatTrend, string> = {
  up: "bg-covered-soft text-covered",
  down: "bg-conflict-soft text-conflict",
  flat: "bg-overlay text-body",
};
const icon = { up: TrendingUp, down: TrendingDown, flat: Minus };

export function StatCard({ title, value, delta, trend = "up", description }: {
  title: string; value: string; delta?: string; trend?: StatTrend; description?: string;
}) {
  const Icon = icon[trend];
  return (
    <div className="flex min-w-0 flex-col gap-2 rounded-[18px] border border-hairline bg-surface p-5">
      <span className="text-[14px] leading-5 font-medium text-body">{title}</span>
      <span className="text-[30px] leading-[36px] font-semibold tracking-[-0.02em] text-strong">{value}</span>
      {(delta || description) && (
        <div className="flex items-center gap-1.5">
          {delta && (
            <span className={`inline-flex h-5 items-center gap-1 rounded-full px-2 text-[12px] leading-none font-medium whitespace-nowrap ${tone[trend]}`}>
              <Icon size={12} strokeWidth={2} aria-hidden />
              {delta}
            </span>
          )}
          {description && <span className="text-[12px] leading-4 text-faint">{description}</span>}
        </div>
      )}
    </div>
  );
}

/** Three cards in a row, as in the dashboard. */
export function StatCardRow({ items }: { items: Parameters<typeof StatCard>[0][] }) {
  return (
    <div className="grid max-w-[760px] grid-cols-3 gap-3.5">
      {items.map((s) => <StatCard key={s.title} {...s} />)}
    </div>
  );
}
