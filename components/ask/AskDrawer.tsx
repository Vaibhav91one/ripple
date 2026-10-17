"use client";

import { AnimatePresence, m } from "motion/react";
import { parseAsString, parseAsStringLiteral, useQueryState } from "nuqs";
import { Suspense, useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import CodeBlock from "@/components/kit/beautifului/code-block";
import PromptBar from "@/components/kit/beautifului/prompt-bar";
import StreamingText, { type SourceRef, type Token } from "@/components/kit/beautifului/streaming-text";
import { ThinkingLive } from "@/components/kit/beautifului/thinking";
import ToolChips, { type ToolRowData } from "@/components/kit/beautifului/tool-chips";
import { askStream, getSource } from "@/lib/api";
import { duration, ease, sec } from "@/lib/motion";
import type { Outcome } from "@/lib/schemas";
import { addText, parseStream } from "./parseStream";

export const SUGGESTIONS = [
  "Who knows the v1 auth flow?",
  "Which contracts still promise v1?",
  "What changed since Monday?",
];

type Tool = { tool: string; cypher: string; rows?: number; ms?: number };
// glue: the last token is a word still being streamed, so a delta that starts mid-word joins it.
type Turn = { question: string; tools: Tool[]; tokens: Token[]; sources: SourceRef[]; done: boolean; glue?: boolean; outcome?: Outcome["outcome"]; rejected?: boolean };
const OUTCOME_NOTE: Partial<Record<Outcome["outcome"], string>> = {
  not_in_graph: "Not in the graph: nothing connects to this, which is not the same as no impact.",
  unknown_entity: "Unknown entity: that name does not resolve, so no traversal ran.",
  memory: "Answered from memory, not from a live traversal.",
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const toolRow = (t: Tool): ToolRowData => ({
  icon: "run",
  label: "Ran query",
  chip: t.tool,
  mono: true,
  detailMono: true,
  detail: [],
  body: <CodeBlock code={t.cypher} language="Cypher" title={t.tool} />,
  meta: t.rows === undefined ? "running…" : `${t.rows} ${t.rows === 1 ? "row" : "rows"}${t.ms === undefined ? "" : ` · ${t.ms}ms`}`,
});

function AskDrawerInner({ autoAsk }: { autoAsk?: string }) {
  const [ask, setAsk] = useQueryState("ask", parseAsStringLiteral(["1"] as const));
  const [, setSrc] = useQueryState("src", parseAsString);
  // false during SSR/hydration so the drawer never mismatches server HTML when ?ask=1 lands mid-hydration.
  const hydrated = useSyncExternalStore(() => () => {}, () => true, () => false);
  const open = hydrated && ask === "1";
  const close = useCallback(() => void setAsk(null), [setAsk]);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const panel = useRef<HTMLElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const started = useRef(false);

  const update = (fn: (t: Turn) => Turn) =>
    setTurns((ts) => [...ts.slice(0, -1), fn(ts[ts.length - 1])]);

  const submit = useCallback(async (question: string) => {
    const q = question.trim();
    if (!q || busy) return;
    setError(null);
    setBusy(true);
    setTurns((ts) => [...ts, { question: q, tools: [], tokens: [], sources: [], done: false }]);
    try {
      for await (const e of parseStream(askStream(q))) {
        await sleep(160);
        const refs = e.type === "citation"
          ? await Promise.all(e.sources.map(async (s): Promise<SourceRef> => {
              const title = await getSource(s.artifactId).then((a) => a.title, () => s.artifactId);
              return { name: title, domain: title, title: `${title} (${s.artifactId})`, onClick: () => void setSrc(s.artifactId) };
            }))
          : [];
        setTurns((ts) => {
          const t = ts[ts.length - 1];
          let next = t;
          if (e.type === "tool_call") next = { ...t, tools: [...t.tools, { tool: e.tool, cypher: e.cypher }] };
          else if (e.type === "tool_result")
            next = { ...t, tools: t.tools.map((x) => (x.tool === e.tool && x.rows === undefined ? { ...x, rows: e.rowCount ?? e.rows.length, ms: e.ms } : x)) };
          else if (e.type === "text_delta")
            next = addText(t, e.text);
          else if (e.type === "citation") {
            next = { ...t, tokens: [...t.tokens, ...refs.map((cite) => ({ text: "", cite }))], sources: [...t.sources, ...refs], glue: false };
          } else if (e.type === "done") next = { ...t, done: true, outcome: e.outcome?.outcome, rejected: !!e.rejected };
          return [...ts.slice(0, -1), next];
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      update((t) => ({ ...t, done: true }));
      setBusy(false);
    }
  }, [busy, setSrc]);

  // Demo only: auto-submit once the drawer is open.
  useEffect(() => {
    if (open && autoAsk && !started.current) {
      started.current = true;
      void submit(autoAsk);
    }
  }, [open, autoAsk, submit]);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight });
  }, [turns]);

  // Focus in on open; Esc closes; Tab is trapped inside the panel.
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const t = setTimeout(() => panel.current?.querySelector<HTMLElement>("textarea")?.focus(), 0);
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") return void close();
      if (ev.key !== "Tab" || !panel.current) return;
      const f = [...panel.current.querySelectorAll<HTMLElement>("button, textarea, a[href]")].filter((el) => !el.hasAttribute("disabled"));
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (!panel.current.contains(document.activeElement)) { ev.preventDefault(); first.focus(); }
      else if (ev.shiftKey && document.activeElement === first) { ev.preventDefault(); last.focus(); }
      else if (!ev.shiftKey && document.activeElement === last) { ev.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKey);
    return () => { clearTimeout(t); document.removeEventListener("keydown", onKey); prev?.focus?.(); };
  }, [open, close]);

  return (
    <AnimatePresence>
      {open && (
        <m.aside
          ref={panel}
          role="dialog"
          aria-modal="true"
          aria-label="Ask Ripple"
          initial={{ x: "100%" }}
          animate={{ x: 0, transition: { duration: sec(duration.drawer), ease: ease.enter } }}
          exit={{ x: "100%", transition: { duration: sec(duration.drawer), ease: ease.exit } }}
          className="fixed inset-y-0 right-0 z-50 flex w-105 max-w-full flex-col border-l border-hairline bg-surface text-body shadow-[var(--kit-shadow-overlay)]"
        >
          <header className="flex h-12 shrink-0 items-center justify-between border-b border-hairline px-4">
            <h2 className="text-[13px] font-medium text-strong">Ask Ripple</h2>
            <button type="button" aria-label="Close" onClick={close} className="flex size-7 items-center justify-center rounded-md text-faint transition-colors duration-100 hover:bg-overlay hover:text-strong">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
            </button>
          </header>

          <div ref={scroller} className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 py-4">
            {turns.length === 0 && (
              <div className="flex flex-col gap-1.5">
                <p className="mb-1 text-[12px] font-medium text-faint">Suggested</p>
                {SUGGESTIONS.map((s) => (
                  <button key={s} type="button" onClick={() => submit(s)} className="w-fit rounded-full bg-raised px-3 py-1.5 text-left text-[12.5px] text-strong shadow-[var(--kit-shadow-hairline)] transition-colors duration-100 hover:bg-overlay">
                    {s}
                  </button>
                ))}
              </div>
            )}
            {turns.map((t, i) => {
              const last = i === turns.length - 1;
              const streaming = last && busy;
              return (
                <div key={i} className="flex flex-col gap-3">
                  <p className="ml-auto max-w-[85%] rounded-xl bg-raised px-3 py-2 text-[13px] leading-normal text-strong" style={{ animation: "fade-up 300ms cubic-bezier(0.23,1,0.32,1) both" }}>{t.question}</p>
                  {t.tools.length > 0 && (
                    <ToolChips live rows={t.tools.map(toolRow)} diffs={[]} summary={`${t.tools.length} ${t.tools.length === 1 ? "query" : "queries"}`} />
                  )}
                  {streaming && t.tokens.length === 0 && !t.done && <ThinkingLive label={t.tools.length ? "Checking the answer against the graph…" : "Thinking"} />}
                  {t.tokens.length > 0 && (
                    <StreamingText tokens={t.tokens} sources={t.sources} followUps={[]} streaming={streaming && !t.done} />
                  )}
                  {t.done && (t.rejected || (t.outcome && OUTCOME_NOTE[t.outcome])) && (
                    <p className="text-[11.5px] leading-normal text-faint">
                      {t.rejected && "Rewritten from the graph rows: the draft named something the graph didn't return. "}
                      {t.outcome && OUTCOME_NOTE[t.outcome]}
                    </p>
                  )}
                </div>
              );
            })}
            {error && <p role="alert" className="text-[12.5px] text-conflict">{error}</p>}
          </div>

          <div className="shrink-0 border-t border-hairline p-3">
            <PromptBar compact onSubmit={submit} busy={busy} placeholder="Ask about your company…" />
          </div>
        </m.aside>
      )}
    </AnimatePresence>
  );
}

// useQueryState reads search params, so it needs a Suspense boundary above it.
export function AskDrawer(props: { autoAsk?: string }) {
  return (
    <Suspense>
      <AskDrawerInner {...props} />
    </Suspense>
  );
}
