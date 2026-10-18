import type { LucideIcon } from "lucide-react";
import { Bot, CircleCheck, CircleX, FileSearch, GitBranch, Mail, Megaphone, Network, PlayCircle, ShieldAlert, ThumbsUp, Truck } from "lucide-react";
import type { TimelineEvent } from "@/lib/schemas/reports";

export const KIND_ICON: Record<TimelineEvent["kind"], LucideIcon> = {
  announced: Megaphone, traversed: Network, proposed: Bot, approved: CircleCheck, rejected: CircleX, notified: Mail,
  delivered: Truck, ack: ThumbsUp, issue: GitBranch, conflict: ShieldAlert, audit: FileSearch, run: PlayCircle,
};

/** Segmented control (margin's "Cost | Hours"). With `tabs` (an id prefix) it is a tablist whose panels use `panelId`;
 *  without, a group of toggle buttons for filters. */
export function Segmented<T extends string>({ value, options, onChange, label, tabs }: { value: T; options: { id: T; label: string }[]; onChange: (v: T) => void; label: string; tabs?: string }) {
  return (
    <div role={tabs ? "tablist" : "group"} aria-label={label} className="inline-flex rounded-control bg-raised p-1">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => onChange(o.id)}
          {...(tabs ? { role: "tab", id: `${tabs}-tab-${o.id}`, "aria-selected": o.id === value, "aria-controls": panelId(tabs, o.id) } : { "aria-pressed": o.id === value })}
          className={`h-8 whitespace-nowrap rounded-[calc(var(--radius-control)-4px)] px-3 text-sm font-medium focus-visible:outline-2 focus-visible:outline-ripple ${o.id === value ? "bg-surface text-strong shadow-[0_1px_2px_oklch(0_0_0/0.08)]" : "text-faint hover:text-strong"}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export const panelId = (tabs: string, id: string) => `${tabs}-panel-${id}`;

/** The panel of the active tab. */
export function TabPanel({ tabs, id, children }: { tabs: string; id: string; children: React.ReactNode }) {
  return <div role="tabpanel" id={panelId(tabs, id)} aria-labelledby={`${tabs}-tab-${id}`}>{children}</div>;
}

/** Seeded history is labelled, quietly. */
export const DemoTag = () => <span className="rounded-full border border-hairline px-1.5 py-px text-3xs font-medium uppercase tracking-[0.06em] text-faint">Demo</span>;
