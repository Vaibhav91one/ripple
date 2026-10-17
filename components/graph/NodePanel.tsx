"use client";

import { AnimatePresence, m } from "motion/react";
import { X } from "lucide-react";
import { useSourcePanel } from "@/components/panels/SourcePanel";
import { teamName } from "@/lib/permissions/classify";
import { duration, ease, sec } from "@/lib/motion";
import { STATUS_LABEL, type Inspected } from "./model";

const BADGE = { conflict: "bg-conflict-soft text-conflict", gap: "bg-gap-soft text-gap", covered: "bg-covered-soft text-covered", neutral: "bg-raised text-faint" } as const;

/** Side panel for the selected node: properties, neighbours and the sourced edges (chips open SourcePanel). */
export function NodePanel({ info, onSelect, onClose }: { info: Inspected | null; onSelect: (id: string) => void; onClose: () => void }) {
  const source = useSourcePanel();
  return (
    <AnimatePresence>
      {info && (
        <m.aside
          key="panel"
          aria-label="Node details"
          className="absolute bottom-3 right-3 top-[64px] z-10 flex w-[320px] max-w-[calc(100%-1.5rem)] flex-col overflow-hidden rounded-xl bg-surface text-body shadow-[var(--kit-shadow-overlay)]"
          initial={{ opacity: 0, x: 12 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 12 }}
          transition={{ duration: sec(duration.drawer), ease: ease.enter }}
        >
          <header className="flex items-start justify-between gap-3 border-b border-hairline p-4">
            <div className="min-w-0 space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="rounded-sm bg-raised px-1.5 py-0.5 font-mono text-xs uppercase text-faint">{info.kind}</span>
                {info.status !== "neutral" && <span className={`rounded-sm px-1.5 py-0.5 text-xs ${BADGE[info.status]}`}>{STATUS_LABEL[info.status]}</span>}
              </div>
              <h2 className="text-md leading-snug text-strong">{info.title}</h2>
            </div>
            <button aria-label="Close details" onClick={onClose} className="rounded-sm p-1 text-faint hover:bg-raised hover:text-strong focus-visible:outline-2 focus-visible:outline-ripple transition-colors">
              <X className="size-4" />
            </button>
          </header>

          <div className="flex-1 space-y-5 overflow-y-auto p-4">
            <section>
              <h3 className="mb-2 font-mono text-xs uppercase text-faint">Properties</h3>
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
                {info.props.map(([k, v]) => (
                  <div key={k} className="contents">
                    <dt className="text-faint">{k}</dt>
                    <dd className="text-right text-strong">{v}</dd>
                  </div>
                ))}
              </dl>
            </section>

            <section>
              <h3 className="mb-2 font-mono text-xs uppercase text-faint">Neighbours</h3>
              <ul className="space-y-1">
                {info.neighbours.map((n) => (
                  <li key={`${n.id}-${n.type}`}>
                    <button onClick={() => onSelect(n.id)} className="flex w-full items-center justify-between gap-3 rounded-sm px-2 py-1 text-left text-sm hover:bg-raised focus-visible:outline-2 focus-visible:outline-ripple transition-colors">
                      <span className="truncate text-strong">{n.title}</span>
                      <span className="shrink-0 font-mono text-xs text-faint">{n.type}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>

            <section>
              <h3 className="mb-2 font-mono text-xs uppercase text-faint">Sourced edges</h3>
              {info.sourced.length === 0 && <p className="text-sm text-faint">No source is attached to these edges.</p>}
              <ul className="space-y-3">
                {info.sourced.map((s) => (
                  <li key={s.edge + s.type} className="space-y-1.5">
                    <p className="text-sm text-strong">
                      {s.edge} <span className="font-mono text-xs text-faint">{s.type}</span>
                    </p>
                    {s.sources.map((src) => (
                      <button
                        key={src.artifactId + src.quote}
                        onClick={() => source.open(src.artifactId, src.quote)}
                        className="block w-full rounded-md border border-hairline bg-page p-2 text-left hover:border-ripple focus-visible:outline-2 focus-visible:outline-ripple transition-colors"
                      >
                        <span className="font-mono text-xs text-ripple">{src.artifactId}</span>
                        <span className="mt-0.5 line-clamp-2 block text-xs text-body">{src.restricted ? `Restricted to ${teamName(src.restricted)}` : `“${src.quote}”`}</span>
                      </button>
                    ))}
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </m.aside>
      )}
    </AnimatePresence>
  );
}
