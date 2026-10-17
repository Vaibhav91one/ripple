import { Sparkles } from "lucide-react";

export function ExplainBox({ title, body }: { title: string; body: string }) {
  return (
    <aside className="flex min-w-[520px] max-w-[620px] gap-3 rounded-control border border-ripple/20 bg-ripple-soft px-3 py-2.5">
      <Sparkles aria-hidden className="mt-0.5 size-3.5 shrink-0 text-ripple" />
      <div className="space-y-0.5">
        <h3 className="text-xs font-medium text-ripple">{title}</h3>
        <p className="text-xs leading-[19px] text-strong">{body}</p>
      </div>
    </aside>
  );
}
