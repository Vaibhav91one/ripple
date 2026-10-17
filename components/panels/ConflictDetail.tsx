"use client";

import { useState } from "react";
import { useQueries } from "@tanstack/react-query";
import { FileText } from "lucide-react";
import { getSource } from "@/lib/api";
import type { Conflict, Source } from "@/lib/schemas";
import DiffTable from "@/components/kit/beautifului/diff-table";
import ApprovalCard from "@/components/kit/beautifului/approval-card";
import { SlideConfirm } from "@/components/kit/bencho/slide-confirm";
import { highlightQuote } from "./highlight";
import { useSourcePanel } from "./SourcePanel";

export type Choice = "acknowledge" | "move_date" | "negotiate";

const CHOICES: { id: Choice; label: string }[] = [
  { id: "acknowledge", label: "Acknowledge" },
  { id: "move_date", label: "Move the date" },
  { id: "negotiate", label: "Negotiate" },
];

function Clause({ source, title }: { source: Source; title?: string }) {
  const panel = useSourcePanel();
  return (
    <div className="space-y-3 py-1">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => panel.open(source.artifactId, source.quote)}
          className="inline-flex max-w-[60%] items-center gap-1.5 rounded-sm bg-raised px-2 py-1 text-xs text-body hover:bg-overlay hover:text-strong focus-visible:outline-2 focus-visible:outline-ripple transition-colors"
        >
          <FileText className="size-3 shrink-0" />
          <span className="truncate">{title ?? source.artifactId}</span>
        </button>
      </div>
      <p className="text-md leading-relaxed text-body">
        {highlightQuote(source.quote, source.quote).map((s, i) =>
          s.hit ? <mark key={i} className="rounded-sm bg-conflict-soft px-0.5 text-strong">{s.text}</mark> : <span key={i}>{s.text}</span>,
        )}
      </p>
    </div>
  );
}

export function ConflictDetail({
  conflict,
  arrAtRisk,
  onResolve,
}: {
  conflict: Conflict;
  arrAtRisk: number;
  onResolve: (choice: Choice) => void;
}) {
  const [decision, ...guarantees] = conflict.sources;
  const arts = useQueries({
    queries: conflict.sources.map((s) => ({ queryKey: ["source", s.artifactId], queryFn: () => getSource(s.artifactId) })),
  });

  const [confirming, setConfirming] = useState(false);

  return (
    <section className="overflow-hidden rounded-lg border border-hairline bg-surface">
      <header className="flex items-center justify-between gap-4 border-b border-hairline p-4">
        <div className="flex items-center gap-3">
          <span className="rounded-sm bg-conflict-soft px-2 py-0.5 text-xs font-medium uppercase text-conflict">{conflict.severity} severity</span>
          <h2 className="text-lg text-strong">A promise and a decision disagree</h2>
        </div>
        <p className="text-sm text-body">
          {conflict.contractIds.length} contracts · ${Math.round(arrAtRisk / 1000)}k at risk
        </p>
      </header>

      <DiffTable
        title="Decision vs guarantee"
        animate={false}
        className="max-w-none rounded-none"
        columns={[
          { label: "Decision source · RFC", width: "50%" },
          { label: "Guarantee source · contracts", width: "50%" },
        ]}
        rows={[
          {
            id: "pair",
            tone: "plain",
            cells: [
              <Clause key="d" source={decision} title={arts[0].data?.title} />,
              <div key="g" className="space-y-4">
                {guarantees.map((g, i) => (
                  <Clause key={g.artifactId} source={g} title={arts[i + 1].data?.title} />
                ))}
              </div>,
            ],
          },
        ]}
      />

      <div className="space-y-4 border-t border-hairline p-4">
        <ApprovalCard
          questions={[{ q: "How do you want to resolve it?", type: "radio", options: CHOICES.map((c) => c.label) }]}
          sentLabel="Choice recorded"
          onReset={() => setConfirming(false)}
          onSubmit={([a]) => {
            const choice = CHOICES[a.selected[0]].id;
            if (choice === "acknowledge") setConfirming(true);
            else onResolve(choice);
          }}
        />
        {confirming && (
          <div className="space-y-2">
            <p className="text-xs text-faint">Slide to confirm Acknowledge</p>
            <SlideConfirm label="Slide to acknowledge" doneLabel="Acknowledged" onConfirm={() => onResolve("acknowledge")} />
          </div>
        )}
      </div>
    </section>
  );
}
