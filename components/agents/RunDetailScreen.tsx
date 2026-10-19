"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { ago, kindLabel, STATUS_TONE, useNames } from "@/components/approvals/shared";
import CodeBlock from "@/components/kit/beautifului/code-block";
import ToolChips, { type ToolRowData } from "@/components/kit/beautifului/tool-chips";
import { GraphDownBanner, LoadingBlock } from "@/components/states/States";
import { StatusStrip } from "@/components/ui/status-strip";
import { Pill } from "@/components/ui/tone";
import { getRun, isGraphDown, NotFoundError } from "@/lib/api";
import type { RunDetail } from "@/lib/schemas";

const compact = (v: unknown) => {
  const s = v === undefined || v === null ? "" : JSON.stringify(v);
  return s === "{}" ? "no arguments" : s;
};
const dur = (ms: number | null) => (ms === null ? "running" : ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`);

/** A tool call becomes a row: arguments as the chip, then Cypher (CodeBlock) and the sources it cited when opened. */
function rows(steps: RunDetail["steps"]): ToolRowData[] {
  return steps.map((s) =>
    s.kind === "validation"
      ? { icon: "think", label: "Rejected", chip: "Answer failed validation", mono: false, detailMono: false, detail: [{ text: `${((s.args as { rejected?: string[] })?.rejected ?? []).join("; ")} (outcome: ${(s.args as { outcome?: string })?.outcome})` }] }
      : s.kind === "text"
      ? { icon: "think", label: "Replied", chip: "Wrote the answer", mono: false, detailMono: false, detail: [{ text: "The model's text for this step is not stored, only its cost." }], meta: `${s.tokens} tok` }
      : {
          icon: s.cypher.length ? "run" : "read", label: s.tool ?? "tool", chip: compact(s.args), mono: true, detailMono: true, detail: [], meta: `${s.rowCount ?? 0} ${s.rowCount === 1 ? "row" : "rows"} · ${s.durationMs === null ? "?" : dur(s.durationMs)} · ${s.tokens} tok`,
          body: (
            <div className="space-y-2 py-1">
              {s.cypher.map((c, i) => <CodeBlock key={i} code={c} language="Cypher" title={`query ${i + 1}`} stream={false} className="max-w-none" />)}
              <p className="font-mono text-xs text-faint">
                {s.sources.length ? <>Cited: {s.sources.map((x) => <span key={x} className="mr-1.5 rounded-md bg-overlay px-1.5 py-0.5 text-body">{x}</span>)}</> : "No sources cited"}
              </p>
            </div>
          ),
        },
  );
}

export function RunDetailScreen({ id }: { id: string }) {
  const [now] = useState(() => Date.now());
  const { title } = useNames();
  const { data, isPending, error, refetch } = useQuery({ queryKey: ["run", id], queryFn: () => getRun(id), retry: false });
  if (isPending) return <div className="mx-auto w-full max-w-[760px] px-4 py-8"><LoadingBlock label="Loading run" /></div>;
  if (!data) {
    return (
      <div className="mx-auto w-full max-w-[760px] space-y-4 px-4 py-8">
        {isGraphDown(error) && <GraphDownBanner onRetry={() => void refetch()} />}
        <p className="rounded-card border border-dashed border-hairline p-6 text-sm text-faint">{error instanceof NotFoundError ? "This run doesn't exist, or it belongs to another org." : "The run could not be loaded."}</p>
        <Link href="/agents" className="text-sm text-ripple-ink underline-offset-4 hover:underline">Back to agents</Link>
      </div>
    );
  }
  const { run, steps, proposals } = data;
  const out = run.output === null || run.output === undefined ? null : JSON.stringify(run.output, null, 2);

  return (
    <div className="mx-auto flex w-full max-w-[760px] flex-col gap-8 px-4 py-6 sm:px-8 sm:py-8">
      <StatusStrip
        crumb={["Agents", run.agent]} title={run.id.slice(0, 8)} status={{ label: run.status, tone: STATUS_TONE[run.status] ?? "gap" }}
        meta={run.error ?? `Triggered by ${run.trigger}`}
        cells={[
          { label: "Started", value: ago(run.startedAt, now) },
          { label: "Duration", value: dur(run.durationMs) },
          { label: "Tokens", value: run.tokens.toLocaleString("en-GB") },
          { label: "Steps", value: String(steps.length) },
        ]}
      />

      <section aria-labelledby="steps" className="space-y-3">
        <h2 id="steps" className="text-sm font-medium text-strong">What it did</h2>
        {steps.length ? <ToolChips live defaultOpen rows={rows(steps)} diffs={[]} summary={`${steps.filter((s) => s.kind === "tool").length} tool calls, ${steps.filter((s) => s.kind === "text").length} messages`} /> : <p className="text-sm text-faint">No steps were recorded.</p>}
      </section>

      {out && (
        <section aria-labelledby="output" className="space-y-3">
          <h2 id="output" className="text-sm font-medium text-strong">Output</h2>
          <CodeBlock code={out} language="JSON" title="output.json" stream={false} className="max-w-none" />
        </section>
      )}

      <section aria-labelledby="props" className="space-y-3">
        <h2 id="props" className="text-sm font-medium text-strong">Proposals it made</h2>
        {proposals.length ? (
          <ul className="divide-y divide-hairline overflow-hidden rounded-card border border-hairline bg-surface">
            {proposals.map((p) => (
              <li key={p.id}>
                <Link href={`/reports?a=${p.id}`} className="flex items-center gap-3 px-4 py-3 outline-none hover:bg-raised focus-visible:bg-raised focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ripple">
                  <span className="hidden w-28 shrink-0 font-mono text-2xs text-faint sm:block">{kindLabel(p.kind)}</span>
                  <span className="min-w-0 flex-1 truncate text-sm text-strong">{title(p)}</span>
                  <Pill tone={STATUS_TONE[p.status] ?? "gap"} dot>{p.status}</Pill>
                </Link>
              </li>
            ))}
          </ul>
        ) : <p className="text-sm text-faint">This run proposed nothing.</p>}
      </section>
    </div>
  );
}
