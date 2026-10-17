"use client";

import { Check, RotateCcw, X } from "lucide-react";
import { m } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { EvidenceDiff } from "@/components/ui/evidence-diff";
import { ExplainBox } from "@/components/ui/explain-box";
import { ResolveOptions } from "@/components/ui/resolve-options";
import { Pill } from "@/components/ui/tone";
import { duration, ease, sec } from "@/lib/motion";
import type { ApprovalRow } from "@/lib/schemas";
import { ago, btn, btnPrimary, kindLabel, STATUS_TONE } from "./shared";

export type Decision = { decision: "approve" | "reject"; note?: string; bulk?: boolean };

const pct = (c?: number) => (c === undefined ? "" : ` (${Math.round(c * 100)}% sure)`);

/** Why this is on your list, in a sentence. */
function why(r: ApprovalRow): { title: string; body: string } {
  const q = r.evidence.length;
  const inferred = r.evidence.some((e) => e.structured === false);
  const conf = r.evidence.find((e) => e.confidence !== undefined)?.confidence;
  return {
    title: inferred ? "Inferred, not stated" : "Why this was proposed",
    body: `${r.proposer} proposed this${r.changeId ? ` for change ${r.changeId}` : ""}${q ? `, citing ${q} source ${q === 1 ? "quote" : "quotes"}${pct(conf)}` : ""}.${inferred ? " The source does not say it outright, so a person confirms it before it reaches the graph." : ""}`,
  };
}

export function ApprovalDrawer({ row, now, siblings, busy, error, readOnly, onDecide, onClose }: {
  row: ApprovalRow; now: number;
  /** Other pending actions of the same kind and change that "approve all" would also decide. */
  siblings: number;
  busy: boolean; error?: string;
  /** Why the buttons are missing, when they are. */
  readOnly?: string;
  onDecide: (d: Decision) => void; onClose: () => void;
}) {
  const [note, setNote] = useState("");
  const [same, setSame] = useState("same");
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    closeRef.current?.focus();
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onClose]);

  const failed = row.status === "failed";
  const q = row.question;
  const verdict: Decision["decision"] = q && same === "different" ? "reject" : "approve";
  const e0 = row.evidence[0];
  const explain = why(row);

  return (
    <>
      <m.div aria-hidden onClick={onClose} className="fixed inset-0 z-30 bg-page/60" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: sec(duration.fast) }} />
      <m.aside
        role="dialog" aria-label={row.summary}
        initial={{ x: 32, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 32, opacity: 0 }}
        transition={{ duration: sec(duration.drawer), ease: ease.enter }}
        className="fixed inset-y-0 right-0 z-40 flex w-full max-w-[600px] flex-col border-l border-hairline bg-raised shadow-lg"
      >
        <header className="flex items-start gap-3 border-b border-hairline px-5 py-4">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2 text-xs text-faint">
              <span className="font-mono">{kindLabel(row.kind)}</span>
              <Pill tone={STATUS_TONE[row.status] ?? "gap"} dot>{row.status}</Pill>
              <span>{ago(row.requestedAt, now)}</span>
            </div>
            <h2 className="mt-1.5 text-md font-medium leading-6 text-strong [overflow-wrap:anywhere]">{row.summary}</h2>
          </div>
          <button ref={closeRef} type="button" onClick={onClose} aria-label="Close" className="grid size-8 shrink-0 place-items-center rounded-full border border-hairline bg-surface text-strong outline-none focus-visible:outline-2 focus-visible:outline-ripple">
            <X size={14} aria-hidden />
          </button>
        </header>

        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5">
          {failed && row.error && (
            <div role="alert" className="rounded-control border border-conflict/30 bg-conflict-soft px-3 py-2.5">
              <p className="text-xs font-medium text-conflict">It failed when it ran</p>
              <p className="mt-0.5 text-xs text-strong [overflow-wrap:anywhere]">{row.error}</p>
              <p className="mt-1 text-2xs text-faint">Approving again retries it.</p>
            </div>
          )}

          <ExplainBox {...explain} />

          {q && e0 ? (
            <EvidenceDiff
              title="Same entity?" found={`${row.evidence.length} source${row.evidence.length === 1 ? "" : "s"}`} action={e0.src ?? "source"}
              docLine={q.name}
              groups={[
                { label: "Written in the source", chips: [{ text: q.name, tone: "conflict" }], caption: "The name as it appears." },
                { label: "Already in the graph", chips: [{ text: q.nodeId, tone: "covered" }], caption: "Approving records the alias; the graph itself is not rewritten." },
              ]}
            />
          ) : null}
          {q && (
            <ResolveOptions
              heading="Is this the same entity?" value={same} onChange={setSame}
              options={[
                { id: "same", title: `Yes, "${q.name}" is ${q.nodeId}`, sub: "Later ingests resolve this name to that node exactly.", tag: "approve" },
                { id: "different", title: "No, keep them separate", sub: "Nothing is recorded; the name stays unresolved.", tag: "reject" },
              ]}
            />
          )}

          <section aria-label="Proposal">
            <h3 className="text-2xs font-medium uppercase tracking-[0.06em] text-faint">What changes</h3>
            <dl className="mt-2 divide-y divide-hairline rounded-card border border-hairline bg-surface">
              {row.fields.map((f) => (
                <div key={f.label} className="grid grid-cols-[minmax(0,110px)_1fr] gap-3 px-3 py-2 text-xs sm:grid-cols-[140px_1fr]">
                  <dt className="text-faint">{f.label}</dt>
                  <dd className="text-strong [overflow-wrap:anywhere]">{f.value}</dd>
                </div>
              ))}
            </dl>
          </section>

          {row.evidence.some((e) => e.quote) && (
            <section aria-label="Evidence">
              <h3 className="text-2xs font-medium uppercase tracking-[0.06em] text-faint">Evidence</h3>
              <ul className="mt-2 space-y-2">
                {row.evidence.filter((e) => e.quote).map((e, i) => (
                  <li key={i} className="rounded-card border border-hairline bg-surface px-3 py-2.5">
                    <p className="text-xs leading-5 text-strong [overflow-wrap:anywhere]">&ldquo;{e.quote}&rdquo;</p>
                    <p className="mt-1 font-mono text-3xs text-faint [overflow-wrap:anywhere]">{e.src ?? "unknown source"}{pct(e.confidence)}</p>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {row.decidedAt && <p className="text-xs text-faint">Decided {ago(row.decidedAt, now)} by {row.approver === "policy" ? "org policy" : row.approver ?? "someone"}.</p>}

          {!readOnly && (
            <label className="block">
              <span className="text-2xs font-medium uppercase tracking-[0.06em] text-faint">Note (optional)</span>
              <textarea
                value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} rows={2} placeholder="Why, for the audit log"
                className="mt-2 w-full resize-none rounded-control border border-hairline bg-surface px-3 py-2 text-sm text-strong outline-none placeholder:text-faint focus-visible:outline-2 focus-visible:outline-ripple"
              />
            </label>
          )}
        </div>

        <footer className="space-y-2 border-t border-hairline px-5 py-4">
          {error && <p role="alert" className="text-xs text-conflict">{error}</p>}
          {readOnly ? (
            <p className="text-xs text-faint">{readOnly}</p>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" disabled={busy} onClick={() => onDecide({ decision: verdict, note: note || undefined })} className={btnPrimary}>
                {failed ? <RotateCcw size={14} aria-hidden /> : <Check size={14} aria-hidden />}
                {failed ? "Approve again" : verdict === "reject" ? "Keep separate" : "Approve"}
              </button>
              {!failed && !q && <button type="button" disabled={busy} onClick={() => onDecide({ decision: "reject", note: note || undefined })} className={btn}>Reject</button>}
              {siblings > 0 && !failed && (
                <button type="button" disabled={busy} onClick={() => onDecide({ decision: verdict, note: note || undefined, bulk: true })} className={`${btn} sm:ml-auto`}>
                  {verdict === "reject" ? "Reject" : "Approve"} all {siblings + 1} like this
                </button>
              )}
            </div>
          )}
        </footer>
      </m.aside>
    </>
  );
}
