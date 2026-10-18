import Link from "next/link";
import { ChevronRight, Sparkles } from "lucide-react";

/** The page's one gradient card: what Ripple noticed, one number, one action. Use at most once per page. */
export function InsightCard({ tag = "Ripple noticed", counter, figure, figureNote, headline, body, action }: { tag?: string; counter?: string; figure?: string; figureNote?: string; headline: string; body?: string; action?: { label: string; href: string } }) {
  return (
    <section className="relative flex min-h-[320px] flex-col overflow-hidden rounded-card p-6 text-ink-on-strong" style={{ backgroundImage: "var(--insight-bg)" }}>
      <span aria-hidden className="pointer-events-none absolute -bottom-16 -right-10 size-56 rounded-full border border-ink-on-strong/25 bg-ink-on-strong/10" />
      <div className="relative flex items-center justify-between text-xs">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-ink-on-strong/25 bg-ink-on-strong/10 px-2.5 py-1">
          <Sparkles size={12} aria-hidden />
          {tag}
        </span>
        {counter && <span className="opacity-80">{counter}</span>}
      </div>
      {figure && (
        <p className="relative mt-6 flex items-end gap-3">
          <span className="text-5xl font-light leading-none tracking-[-0.04em]">{figure}</span>
          {figureNote && <span className="max-w-[12rem] pb-1 text-sm leading-snug opacity-80">{figureNote}</span>}
        </p>
      )}
      <h3 className="relative mt-5 text-lg font-medium leading-snug text-ink-on-strong sm:text-xl">{headline}</h3>
      {body && <p className="relative mb-6 mt-2 text-sm leading-relaxed opacity-80">{body}</p>}
      {action && (
        <Link href={action.href} className="relative mt-auto inline-flex h-10 w-fit items-center gap-1.5 rounded-control bg-surface px-4 text-sm font-medium text-strong hover:bg-raised">
          {action.label}
          <ChevronRight size={15} aria-hidden />
        </Link>
      )}
    </section>
  );
}
