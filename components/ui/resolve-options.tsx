import { Lock } from "lucide-react";

export type ResolveOption = { id: string; title: string; sub: string; tag?: string; locked?: boolean };

/** Radio cards. Controlled: parent owns `value` (see resolve-options-demo.tsx). */
export function ResolveOptions({ heading, options, value, onChange }: {
  heading: string; options: ResolveOption[]; value: string; onChange?: (id: string) => void;
}) {
  return (
    <section className="min-w-0 sm:min-w-[520px] max-w-[620px] rounded-[var(--ref-radius)] border border-hairline bg-surface p-4">
      <h3 className="mb-4 px-0.5 text-md text-strong">{heading}</h3>
      <div role="radiogroup" aria-label={heading} className="space-y-2.5">
        {options.map((o) => {
          const on = o.id === value;
          return (
            <button
              key={o.id}
              type="button"
              role="radio"
              aria-checked={on}
              aria-disabled={o.locked || undefined}
              onClick={() => !o.locked && onChange?.(o.id)}
              className={`flex w-full items-start gap-3 rounded-control border px-3 py-2.5 text-left focus-visible:outline-2 focus-visible:outline-ripple ${
                on ? "border-strong bg-raised shadow-[0_0_0_1px_var(--strong)]" : "border-hairline"
              } ${o.locked ? "cursor-not-allowed opacity-55" : ""}`}
            >
              <span aria-hidden className={`mt-0.5 grid size-4 shrink-0 place-items-center rounded-full border ${on ? "border-strong bg-strong" : "border-faint/60"}`}>
                {on && <span className="size-1.5 rounded-full bg-page" />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2 text-xs font-medium text-strong">
                  {o.title}
                  {o.tag && <span className="text-3xs font-medium text-ripple-ink">{o.tag}</span>}
                </span>
                <span className="mt-0.5 block text-2xs text-faint">{o.sub}</span>
              </span>
              {o.locked && <Lock aria-label="Locked" className="mt-1 size-3.5 shrink-0 text-faint" />}
            </button>
          );
        })}
      </div>
    </section>
  );
}
