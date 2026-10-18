import type { ReactNode } from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ChevronRight, CircleAlert, CircleCheck, MapPin, Repeat } from "lucide-react";
import { Card, CardHeader } from "./card";
import { TINT, type Tone as StatusTone } from "./tone";

/** Shorthand icons (v1 callers): each pairs an icon with its tint. */
const PRESET = {
  warning: { icon: CircleAlert, tone: "conflict" },
  check: { icon: CircleCheck, tone: "gap" },
  pin: { icon: MapPin, tone: "ripple" },
  refresh: { icon: Repeat, tone: "neutral" },
} as const satisfies Record<string, { icon: LucideIcon; tone: StatusTone }>;

export type NeedsYouRow = {
  id?: string;
  /** A preset name, or any lucide icon with `tone`. */
  icon: keyof typeof PRESET | LucideIcon;
  tone?: StatusTone;
  title: string;
  sub: string;
  href?: string;
  /** Rendered under the row (buttons, so they sit outside the link). */
  actions?: ReactNode;
};

export type NeedsYouProps = {
  /** Anchor id of the card (e.g. "needs-you" for a #needs-you link). */
  id?: string;
  title?: string;
  /** Defaults to "<n> things today"; `unit` and `period` change the wording. */
  sub?: string;
  unit?: [one: string, many: string];
  period?: string;
  rows: NeedsYouRow[];
  /** Shown instead of the rows when there are none. */
  empty?: string;
  /** Rows shown before "View all N" (default 5); `moreHref` is where that link goes. */
  max?: number;
  moreHref?: string;
};

/** "Needs you": tinted icon circle, bold line, grey line, chevron. One tint per kind of item. */
export function NeedsYou({ id, title = "Needs you", sub, unit = ["thing", "things"], period = "today", rows, empty = "Nothing needs you right now.", max = 5, moreHref }: NeedsYouProps) {
  const extra = rows.length - max;
  return (
    <Card id={id}>
      <CardHeader title={title} sub={sub ?? `${rows.length} ${rows.length === 1 ? unit[0] : unit[1]} ${period}`} />
      {rows.length === 0 ? (
        <p className="mt-6 text-sm text-faint">{empty}</p>
      ) : (
        <ul className="mt-4 divide-y divide-hairline">
          {rows.slice(0, max).map((r) => {
            const { icon: Icon, tone } = typeof r.icon === "string" ? PRESET[r.icon] : { icon: r.icon, tone: r.tone ?? "neutral" };
            const body = (
              <>
                <span className={`grid size-9 shrink-0 place-items-center rounded-full ${TINT[tone]}`}><Icon size={16} aria-hidden /></span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-md font-medium text-strong" title={r.title}>{r.title}</span>
                  <span className="block truncate text-sm text-faint" title={r.sub}>{r.sub}</span>
                </span>
                {r.href && <ChevronRight size={16} className="shrink-0 text-faint" aria-hidden />}
              </>
            );
            const row = "-mx-2 flex min-h-11 items-center gap-3 rounded-inset px-2 py-3";
            return (
              <li key={r.id ?? r.title}>
                {r.href ? <Link href={r.href} className={`${row} hover:bg-raised/60`}>{body}</Link> : <div className={row}>{body}</div>}
                {r.actions && <div className="-mt-1 flex flex-wrap gap-2 pb-3 pl-12">{r.actions}</div>}
              </li>
            );
          })}
        </ul>
      )}
      {extra > 0 && (moreHref
        ? <Link href={moreHref} className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-strong hover:text-body">View all {rows.length}<ChevronRight size={14} aria-hidden /></Link>
        : <p className="mt-2 text-sm text-faint">+{extra} more</p>)}
    </Card>
  );
}
