"use client";

import { useQuery } from "@tanstack/react-query";
import { Dialog } from "radix-ui";
import { parseAsString, useQueryStates } from "nuqs";
import { ExternalLink, X } from "lucide-react";
import { getPeople, getRipple, getSource } from "@/lib/api";
import RecordsTable, { type RecordRow } from "@/components/kit/beautifului/records-table";
import { fmtDate } from "./format";
import { highlightQuote } from "./highlight";

const params = { src: parseAsString, q: parseAsString };

/** URL state for the panel: `?src=<artifactId>` (plus `&q=<quote>` so a reload keeps the highlight). */
export function useSourcePanel() {
  const [{ src, q }, set] = useQueryStates(params);
  return {
    src,
    quote: q ?? "",
    open: (artifactId: string, quote: string) => set({ src: artifactId, q: quote }),
    close: () => set({ src: null, q: null }),
  };
}

export function SourcePanel({ decisionId = "d-1" }: { decisionId?: string }) {
  const { src, quote, close } = useSourcePanel();
  const artifact = useQuery({ queryKey: ["source", src], queryFn: () => getSource(src!), enabled: !!src });
  const ripple = useQuery({ queryKey: ["ripple", decisionId], queryFn: () => getRipple(decisionId), enabled: !!src });
  const people = useQuery({ queryKey: ["people"], queryFn: getPeople, enabled: !!src });
  const a = artifact.data;
  const claims: RecordRow[] = (ripple.data?.teams ?? []).flatMap((t) =>
    t.why
      .filter((w) => w.source.artifactId === src)
      .map((w) => ({
        id: `${t.teamId}-${w.ref}`,
        name: w.reason,
        tags: [t.teamId],
        last: `“${w.source.quote}”`,
        strength: t.acked ? ("strong" as const) : t.involved ? ("weak" as const) : ("veryweak" as const),
      })),
  );

  return (
    <Dialog.Root open={!!src} onOpenChange={(o) => !o && close()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-page/60 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 motion-reduce:animate-none" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed inset-y-0 right-0 z-50 flex w-full max-w-[520px] flex-col border-l border-hairline bg-surface text-body outline-none data-[state=open]:animate-in data-[state=open]:slide-in-from-right data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right motion-reduce:animate-none"
        >
          <header className="flex items-start justify-between gap-4 border-b border-hairline p-5">
            <div className="min-w-0 space-y-2">
              {a && <span className="inline-block rounded-sm bg-raised px-2 py-0.5 font-mono text-xs uppercase text-faint">{a.docKind ?? a.kind}</span>}
              <Dialog.Title className="text-lg text-strong">{a?.title ?? "Loading source…"}</Dialog.Title>
              {a && (
                <p className="text-sm text-faint">
                  {people.data?.find((p) => p.id === a.authorId)?.name ?? a.authorId} · {fmtDate(a.ts)}
                </p>
              )}
            </div>
            <Dialog.Close aria-label="Close" className="rounded-sm p-1 text-faint hover:bg-raised hover:text-strong focus-visible:outline-2 focus-visible:outline-ripple">
              <X className="size-4" />
            </Dialog.Close>
          </header>

          <div className="flex-1 space-y-6 overflow-y-auto p-5">
            {a && (
              <>
                <p className="whitespace-pre-wrap rounded-md border border-hairline bg-page p-4 text-md leading-relaxed text-body">
                  {highlightQuote(a.text, quote).map((s, i) =>
                    s.hit ? <mark key={i} className="rounded-sm bg-ripple-soft px-0.5 text-strong">{s.text}</mark> : <span key={i}>{s.text}</span>,
                  )}
                </p>
                <a href={a.uri} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-sm text-ripple hover:underline focus-visible:outline-2 focus-visible:outline-ripple">
                  Open in source <ExternalLink className="size-3.5" />
                </a>
              </>
            )}

            <section className="space-y-2">
              <h3 className="font-mono text-xs uppercase text-faint">Claims citing this source</h3>
              {claims.length === 0 ? (
                <p className="text-sm text-faint">No other claims cite this source.</p>
              ) : (
                <RecordsTable rows={claims} labels={["Claim", "Team", "Quote", "Told?", "Links"]} />
              )}
            </section>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
