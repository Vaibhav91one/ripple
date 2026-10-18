import type { LucideIcon } from "lucide-react";
import { Bot, CircleCheck, CircleX, FileSearch, GitBranch, Mail, Megaphone, Network, PlayCircle, ShieldAlert, ThumbsUp, Truck } from "lucide-react";
import type { TimelineEvent } from "@/lib/schemas/reports";

export const KIND_ICON: Record<TimelineEvent["kind"], LucideIcon> = {
  announced: Megaphone, traversed: Network, proposed: Bot, approved: CircleCheck, rejected: CircleX, notified: Mail,
  delivered: Truck, ack: ThumbsUp, issue: GitBranch, conflict: ShieldAlert, audit: FileSearch, run: PlayCircle,
};

/** Segmented control (margin's "Cost | Hours"): a raised track with the active option as a white pill. */
export function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: { id: T; label: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div role="tablist" aria-label={label} className="inline-flex rounded-control bg-raised p-1">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          role="tab"
          aria-selected={o.id === value}
          onClick={() => onChange(o.id)}
          className={`h-8 whitespace-nowrap rounded-[calc(var(--radius-control)-4px)] px-3 text-sm font-medium focus-visible:outline-2 focus-visible:outline-ripple ${o.id === value ? "bg-surface text-strong shadow-[0_1px_2px_oklch(0_0_0/0.08)]" : "text-faint hover:text-strong"}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Seeded history is labelled, quietly. */
export const DemoTag = () => <span className="rounded-full border border-hairline px-1.5 py-px text-3xs font-medium uppercase tracking-[0.06em] text-faint">Demo</span>;
