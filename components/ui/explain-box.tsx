import { Sparkles } from "lucide-react";

export function ExplainBox({ title, body }: { title: string; body: string }) {
  return (
    <aside className="flex min-w-0 max-w-[620px] sm:min-w-[520px] gap-3 rounded-control border border-ripple/20 bg-ripple-soft px-3 py-2.5">
      <Sparkles aria-hidden className="mt-0.5 size-3.5 shrink-0 text-ripple-ink" />
      <div className="space-y-0.5">
        <h3 className="text-xs font-medium text-ripple-ink">{title}</h3>
        <p className="text-xs leading-[19px] text-strong">{body}</p>
      </div>
    </aside>
  );
}
