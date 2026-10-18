"use client";

// Inline result cards in the thread, picked by tool name. Each card re-reads the graph (getRipple) instead of trusting
// tool rows, so live and cached answers render the same card.
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, ChevronRight } from "lucide-react";
import ApprovalCard from "@/components/kit/beautifului/approval-card";
import { useSourcePanel } from "@/components/panels/SourcePanel";
import { StatusPill } from "@/components/ui/status-pill";
import { decideApproval, getRipple } from "@/lib/api";
import { teamName } from "@/lib/permissions/classify";
import type { Source } from "@/lib/schemas";
import type { ToolRun } from "./thread";

const shell = "overflow-hidden rounded-[20px] border border-hairline bg-surface";
const usd = (n: number) => (n >= 1000 ? `$${Math.round(n / 1000)}K` : `$${n}`);

function CaseLink({ id }: { id: string }) {
  return (
    <Link href={`/reports/${encodeURIComponent(id)}`} className="inline-flex items-center gap-1 text-sm font-medium text-strong hover:underline underline-offset-4">
      Open case file<ChevronRight size={14} aria-hidden />
    </Link>
  );
}

const decisionOf = (r: ToolRun) => {
  const fromArgs = r.args.decisionId;
  const fromRows = r.rows?.[0]?.decisionId ?? (r.rows?.[0]?.decision as { id?: unknown } | undefined)?.id;
  const id = typeof fromArgs === "string" ? fromArgs : typeof fromRows === "string" ? fromRows : undefined;
  return id && /^[\w-]{1,40}$/.test(id) ? id : undefined;
};

/** Impact and who-wasn't-told in one card: the counts, then each affected team told or not. */
function ImpactCard({ decisionId }: { decisionId: string }) {
  const { data } = useQuery({ queryKey: ["ripple", decisionId], queryFn: () => getRipple(decisionId) });
  if (!data) return <div className={`${shell} h-40 animate-pulse bg-raised/50`} aria-hidden />;
  const c = data.counts;
  const stats: [string, string][] = [["Teams hit", String(c.teamsAffected)], ["Not told", String(c.notTold)], ["Customers", String(c.customers)], ["ARR at risk", usd(c.arrAtRisk ?? 0)]];
  const teams = [...data.teams].sort((a, b) => Number(a.acked) - Number(b.acked));
  return (
    <section className={shell} aria-label={`Impact of ${data.decision.title}`}>
      <header className="flex items-baseline justify-between gap-3 px-5 pt-4">
        <h3 className="text-md font-medium text-strong">{data.decision.title}</h3>
        <span className="shrink-0 text-xs text-faint">{c.teamsAffected - c.notTold} of {c.teamsAffected} teams told</span>
      </header>
      <dl className="grid grid-cols-2 gap-px px-5 pt-3 sm:grid-cols-4">
        {stats.map(([k, v]) => (
          <div key={k} className="py-1">
            <dt className="text-xs text-faint">{k}</dt>
            <dd className={`text-xl font-light tabular-nums tracking-tight ${k === "Not told" && c.notTold ? "text-gap" : "text-strong"}`}>{v}</dd>
          </div>
        ))}
      </dl>
      <ul className="mt-3 divide-y divide-hairline border-t border-hairline">
        {teams.map((t) => (
          <li key={t.teamId} className="flex items-center gap-3 px-5 py-2.5">
            <span className="w-24 shrink-0 text-sm font-medium text-strong">{teamName(t.teamId)}</span>
            <span className="min-w-0 flex-1 truncate text-sm text-faint">{t.why[0]?.reason}</span>
            {t.acked ? <StatusPill tone="covered">Acked</StatusPill> : t.involved ? <StatusPill tone="ripple">Told</StatusPill> : <StatusPill tone="gap">Not told</StatusPill>}
          </li>
        ))}
      </ul>
      <footer className="flex justify-end border-t border-hairline px-5 py-3"><CaseLink id={decisionId} /></footer>
    </section>
  );
}

function Quote({ s, label, onOpen }: { s: Source; label: string; onOpen: () => void }) {
  return (
    <button type="button" onClick={onOpen} className="group block w-full rounded-[14px] p-3 text-left hover:bg-raised/70">
      <span className="font-mono text-2xs uppercase tracking-wider text-faint">{label}</span>
      {s.restricted ? (
        <span className="mt-1 block text-sm text-faint">Restricted to {teamName(s.restricted)}</span>
      ) : (
        <span className="mt-1 block text-sm leading-relaxed text-body">
          “<mark className="rounded-sm bg-conflict-soft px-0.5 text-strong">{s.quote}</mark>”
        </span>
      )}
      <span className="mt-1 block truncate font-mono text-2xs text-faint group-hover:text-body">{s.artifactId}</span>
    </button>
  );
}

/** Conflict evidence diff: what the decision says next to what the contracts guarantee, each quote opening its source. */
function ConflictCard({ decisionId }: { decisionId: string }) {
  const { data } = useQuery({ queryKey: ["ripple", decisionId], queryFn: () => getRipple(decisionId) });
  const panel = useSourcePanel();
  const k = data?.conflicts.find((x) => x.status === "open") ?? data?.conflicts[0];
  if (!data) return <div className={`${shell} h-40 animate-pulse bg-raised/50`} aria-hidden />;
  if (!k) return null;
  const [decision, ...promises] = k.sources;
  return (
    <section className={shell} aria-label="Contract conflict">
      <header className="flex items-center justify-between gap-3 px-5 pt-4">
        <h3 className="flex items-center gap-2 text-md font-medium text-strong">
          <span className="size-2 rounded-full bg-conflict" aria-hidden />A promise and a decision disagree
        </h3>
        <span className="shrink-0 rounded-full bg-conflict-soft px-2 py-0.5 text-2xs font-medium text-conflict">{k.severity}</span>
      </header>
      <p className="px-5 pt-1 text-sm text-faint">
        {k.contractIds.length} contracts{data.counts.arrAtRisk ? ` · ${usd(data.counts.arrAtRisk)} ARR at risk` : ""}
      </p>
      <div className="mt-3 grid gap-1 border-t border-hairline p-2 sm:grid-cols-2 sm:divide-x sm:divide-hairline">
        <div>{decision && <Quote s={decision} label="The decision says" onOpen={() => panel.open(decision.artifactId, decision.quote)} />}</div>
        <div>{promises.map((s) => <Quote key={s.artifactId} s={s} label="The contract says" onOpen={() => panel.open(s.artifactId, s.quote)} />)}</div>
      </div>
      <footer className="flex justify-end border-t border-hairline px-5 py-3"><CaseLink id={decisionId} /></footer>
    </section>
  );
}

type PathNode = { id?: unknown; label?: unknown; name?: unknown };
/** The evidence path a traversal walked, hop by hop (teal = the traced path). */
function PathCard({ run }: { run: ToolRun }) {
  const nodes = (run.rows?.[0]?.nodes as PathNode[] | undefined) ?? [];
  if (!nodes.length) return null;
  return (
    <section className={`${shell} px-5 py-4`} aria-label="Evidence path">
      <p className="text-xs text-faint">{nodes.length - 1} hops</p>
      <ol className="mt-2 flex flex-wrap items-center gap-1.5">
        {nodes.map((n, i) => (
          <li key={i} className="flex items-center gap-1.5">
            {i > 0 && <ArrowRight size={13} className="text-ripple" aria-hidden />}
            <span className="rounded-full border border-ripple/30 bg-ripple-soft px-2.5 py-1 text-xs text-strong">{String(n.name ?? n.id ?? "")}<span className="ml-1 text-faint">{String(n.label ?? "")}</span></span>
          </li>
        ))}
      </ol>
    </section>
  );
}

/** A pending action an agent proposed. Decidable in local mode; the public demo is read-only. */
function ProposalCard({ run, readonly }: { run: ToolRun; readonly: boolean }) {
  const row = run.rows?.[0] ?? {};
  const id = typeof row.id === "string" ? row.id : undefined;
  const what = typeof run.args.title === "string" ? run.args.title : run.tool.replace(/^propose_/, "").replace(/_/g, " ");
  return (
    <div className="space-y-2">
      <div aria-disabled={readonly || !id} className={readonly || !id ? "pointer-events-none opacity-60" : ""}>
        <ApprovalCard
          questions={[{ q: `Approve: ${what}?`, type: "radio", options: ["Approve", "Reject"] }]}
          sentLabel="Decision recorded"
          onSubmit={([a]) => id && void decideApproval(id, a.selected[0] === 0 ? "approve" : "reject")}
        />
      </div>
      {readonly && <p className="text-xs text-faint">Read-only demo: nothing is sent. Run Ripple locally to approve agent actions.</p>}
    </div>
  );
}

/** Tool name -> card. Tools without a card still show their "Cypher used" chip. */
export function ResultCard({ run, readonly }: { run: ToolRun; readonly: boolean }) {
  if (run.rows === undefined) return null;
  const d = decisionOf(run);
  if ((run.tool === "ripple" || run.tool === "access_gap") && d) return <ImpactCard decisionId={d} />;
  if (run.tool === "contract_conflicts" && d) return <ConflictCard decisionId={d} />;
  if (run.tool === "why_affected" || run.tool === "weighted_path") return <PathCard run={run} />;
  if (run.tool.startsWith("propose_")) return <ProposalCard run={run} readonly={readonly} />;
  return null;
}

/** One card per kind: two ripple calls in one answer show one impact card. */
export const cardRuns = (runs: ToolRun[]) => runs.filter((r, i) => runs.findIndex((x) => x.tool === r.tool && decisionOf(x) === decisionOf(r)) === i);
