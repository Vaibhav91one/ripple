// Beautiful UI (beautifului.dev), MIT, see ./LICENSE. Restyled to Ripple tokens.
"use client";

import "./kit.css";

import { useCallback, useEffect, useState } from "react";

/* ─────────────────────────────────────────────────────────
 * CODE BLOCK
 * Agent-written code streams line by line; copy is live.
 * ───────────────────────────────────────────────────────── */

const LINE_MS = 240;
const HOLD_MS = 3200;

type Tok = { t: string; c?: "kw" | "str" | "num" | "fn" | "dim" };

const LINES: Tok[][] = [
  [{ t: "export async function ", c: "kw" }, { t: "traceChange", c: "fn" }, { t: "() {", c: "dim" }],
  [{ t: "  const ", c: "kw" }, { t: "change = " }, { t: "await ", c: "kw" }, { t: "getDecision", c: "fn" }, { t: "(", c: "dim" }, { t: "\"RFC-14\"", c: "str" }, { t: ");", c: "dim" }],
  [{ t: "  const ", c: "kw" }, { t: "reach = " }, { t: "await ", c: "kw" }, { t: "graph." }, { t: "fetch", c: "fn" }, { t: "({ change });", c: "dim" }],
  [{ t: "  await ", c: "kw" }, { t: "notify." }, { t: "send", c: "fn" }, { t: "(reach, { channel: ", c: "dim" }, { t: "\"slack\"", c: "str" }, { t: " });", c: "dim" }],
  [{ t: "  return ", c: "kw" }, { t: "reach.people;" }],
  [{ t: "}", c: "dim" }],
];

const COLORS: Record<string, string> = {
  kw: "var(--ripple)",
  str: "var(--covered)",
  num: "var(--gap)",
  fn: "var(--strong)",
  dim: "var(--faint)",
};

const RAW = `export async function traceChange() {
  const change = await getDecision("RFC-14");
  const reach = await graph.fetch({ change });
  await notify.store(reach, { channel: "slack" });
  return reach.people;
}`;

export default function CodeBlock() {
  const [count, setCount] = useState(0);
  const [copied, setCopied] = useState(false);
  const done = count >= LINES.length;

  useEffect(() => {
    const t = setTimeout(
      () => setCount((c) => (c >= LINES.length ? 0 : c + 1)),
      count === 0 ? 400 : done ? HOLD_MS : LINE_MS,
    );
    return () => clearTimeout(t);
  }, [count, done]);

  const copy = useCallback(() => {
    navigator.clipboard.writeText(RAW).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }, []);

  return (
    <div className="w-full max-w-95 overflow-hidden rounded-xl bg-surface shadow-[var(--kit-shadow-card)]">
      {/* header */}
      <div className="primitive-card-bar flex items-center justify-between border-b border-hairline">
        <span className="flex items-baseline gap-2">
          <span className="font-mono text-[12px] font-medium text-strong">trace.ts</span>
          <span className="text-[11.5px] text-faint">TypeScript</span>
        </span>
        <button
          aria-label="Copy code"
          onClick={copy}
          className={`flex h-6 items-center gap-1 rounded-[6px] px-1.5 text-[11.5px]
            font-medium transition-colors duration-100 hover:bg-raised
            ${copied ? "text-covered" : "text-faint hover:text-strong"}`}
        >
          {copied ? (
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
          ) : (
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="12" height="12" rx="2.5" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
          )}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>

      {/* code */}
      <pre className="min-h-[137px] bg-page px-3 py-2.5 font-mono text-[11.5px] leading-[1.7]">
        {LINES.slice(0, count).map((line, i) => (
          <div
            key={i}
            className="flex"
            style={{ animation: "fade-up 250ms cubic-bezier(0.23,1,0.32,1) both" }}
          >
            <span className="w-5 shrink-0 text-right text-[10.5px] leading-[1.86] text-faint/60 select-none">
              {i + 1}
            </span>
            <span className="pl-2.5 whitespace-pre">
              {line.map((tok, j) => (
                <span key={j} style={{ color: tok.c ? COLORS[tok.c] : "var(--body)" }}>
                  {tok.t}
                </span>
              ))}
              {i === count - 1 && !done && (
                <span className="ml-0.5 inline-block h-3 w-[3px] translate-y-0.5 rounded-full bg-ripple" />
              )}
            </span>
          </div>
        ))}
              </pre>
    </div>
  );
}
