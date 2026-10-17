import { ChevronRight, CircleAlert, CircleCheck, Ellipsis, MapPin, Repeat } from "lucide-react";
import { card } from "./hatch";

const icons = {
  warning: { Icon: CircleAlert, tone: "bg-conflict-soft text-conflict" },
  check: { Icon: CircleCheck, tone: "bg-gap-soft text-gap" },
  pin: { Icon: MapPin, tone: "bg-ripple-soft text-ripple" },
  refresh: { Icon: Repeat, tone: "bg-raised text-body" },
} as const;

export type NeedsYouProps = {
  title: string;
  sub: string;
  rows: { icon: keyof typeof icons; title: string; sub: string }[];
  menuLabel?: string;
};

export function NeedsYou({ title, sub, rows, menuLabel = "More" }: NeedsYouProps) {
  return (
    <section className={`${card} p-5`}>
      <header className="flex items-start justify-between">
        <div>
          <h4 className="text-[16px] font-medium leading-5 text-strong">{title}</h4>
          <p className="mt-0.5 text-[11px] text-faint">{sub}</p>
        </div>
        <button type="button" aria-label={menuLabel} className="grid size-8 place-items-center rounded-full border border-hairline text-body focus-visible:outline-2 focus-visible:outline-ripple">
          <Ellipsis size={14} />
        </button>
      </header>
      <ul className="mt-2">
        {rows.map((r) => {
          const { Icon, tone } = icons[r.icon];
          return (
            <li key={r.title} className="border-b border-hairline last:border-b-0">
              <button type="button" className="flex w-full items-center gap-3 py-3 text-left focus-visible:outline-2 focus-visible:outline-ripple">
                <span className={`grid size-9 shrink-0 place-items-center rounded-full ${tone}`}><Icon size={16} /></span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-medium leading-4 text-strong">{r.title}</span>
                  <span className="mt-0.5 block text-[11px] text-faint">{r.sub}</span>
                </span>
                <ChevronRight size={14} className="shrink-0 text-faint" />
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
