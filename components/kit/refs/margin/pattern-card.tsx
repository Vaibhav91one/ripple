import { ChevronRight, Sparkles } from "lucide-react";

export type PatternCardProps = {
  pill: string;
  counter: string;
  big: string;
  bigNote: string;
  headline: string;
  body: string;
  button: string;
};

export function PatternCard({ pill, counter, big, bigNote, headline, body, button }: PatternCardProps) {
  return (
    <section
      className="relative flex min-h-[360px] flex-col overflow-hidden rounded-[var(--ref-radius)] p-5 text-[var(--glow-ink)]"
      style={{
        backgroundImage:
          "var(--pattern-bg, radial-gradient(90% 60% at 100% 100%, var(--glow-b), transparent 70%), radial-gradient(70% 50% at 70% 60%, color-mix(in srgb, var(--glow-a) 45%, var(--glow-b)), transparent 80%), linear-gradient(170deg, var(--glow-a) 0%, var(--glow-a) 35%, color-mix(in srgb, var(--glow-a) 55%, var(--glow-b)) 100%))",
      }}
    >
      <span aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.18] mix-blend-overlay"
        style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")" }} />
      <span aria-hidden className="pointer-events-none absolute -bottom-12 right-[-30px] size-52 rounded-full bg-[var(--glow-ink)]/10" />
      <span aria-hidden className="pointer-events-none absolute -bottom-4 right-[-4px] h-32 w-24 rounded-tl-card border-l border-t border-[var(--glow-ink)]/25" />
      <div className="relative flex items-center justify-between text-2xs">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--glow-ink)]/30 bg-[var(--glow-ink)]/10 px-2.5 py-1">
          <Sparkles size={11} />
          {pill}
        </span>
        <span className="opacity-80">{counter}</span>
      </div>
      <div className="relative mt-5 flex items-end gap-2">
        <span className="whitespace-nowrap text-3xl font-normal leading-none tracking-[-0.03em]">{big}</span>
        <span className="max-w-[100px] pb-1 text-3xs leading-[13px] opacity-70">{bigNote}</span>
      </div>
      <h4 className="relative mt-4 text-[var(--glow-ink)] text-lg font-normal leading-[22px] tracking-[-0.01em]">{headline}</h4>
      <p className="relative mt-2 text-xs leading-[17px] opacity-70">{body}</p>
      <button type="button" className="relative mt-auto flex w-fit items-center gap-2 rounded-card bg-[var(--glow-ink)] px-3.5 py-2.5 text-xs font-medium text-[var(--glow-a)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--glow-ink)]">
        {button}
        <ChevronRight size={14} />
      </button>
    </section>
  );
}
