// Beautiful UI (beautifului.dev), MIT, see ./LICENSE. Restyled to Ripple tokens.
"use client";

import "./kit.css";

import { useCallback, useEffect, useState } from "react";

/* ─────────────────────────────────────────────────────────
 * CODE BLOCK
 * Code streams line by line; copy is live. Data in via props.
 * ───────────────────────────────────────────────────────── */

const LINE_MS = 240;
const HOLD_MS = 3200;

type Tok = { t: string; c?: "kw" | "str" | "num" | "fn" | "dim" };

const COLORS: Record<string, string> = {
  kw: "var(--ripple)",
  str: "var(--covered)",
  num: "var(--gap)",
  fn: "var(--strong)",
  dim: "var(--faint)",
};

// ponytail: one regex tokenizer for TS and Cypher; swap for a real highlighter if more languages land.
const KEYWORDS =
  /^(export|async|function|const|let|await|return|import|from|new|MATCH|OPTIONAL|WHERE|RETURN|ORDER|BY|DESC|ASC|WITH|AS|LIMIT|AND|OR|NOT|IN|CREATE|MERGE|SET|DELETE|UNWIND|DISTINCT)$/i;
const TOKEN = /(\/\/.*$)|("[^"]*"|'[^']*')|(\b\d+(?:\.\d+)?\b)|([A-Za-z_]\w*)(?=\()|([A-Za-z_]\w*)|(\s+)|(.)/gy;

function tokenizeLine(line: string): Tok[] {
  const out: Tok[] = [];
  TOKEN.lastIndex = 0;
  for (let m = TOKEN.exec(line); m; m = TOKEN.exec(line)) {
    const [t, comment, str, num, fn, word] = m;
    if (comment) out.push({ t, c: "dim" });
    else if (str) out.push({ t, c: "str" });
    else if (num) out.push({ t, c: "num" });
    else if (fn) out.push({ t, c: "fn" });
    else if (word && KEYWORDS.test(word)) out.push({ t, c: "kw" });
    else if (/^[{}()[\];,:]+$/.test(t)) out.push({ t, c: "dim" });
    else out.push({ t });
  }
  return out;
}

const SAMPLE = `export async function traceChange() {
  const change = await getDecision("RFC-14");
  const reach = await graph.fetch({ change });
  await notify.store(reach, { channel: "slack" });
  return reach.people;
}`;

export default function CodeBlock({
  code = SAMPLE,
  language = "TypeScript",
  title = "trace.ts",
  loop = false,
  stream = true,
  className = "max-w-95",
}: {
  code?: string;
  language?: string;
  title?: string;
  /** Replay the line-by-line stream forever (styleguide demo). */
  loop?: boolean;
  /** false shows every line at once (long queries); the styleguide keeps the stream */
  stream?: boolean;
  className?: string;
}) {
  const lines = code.split("\n").map(tokenizeLine);
  const [count, setCount] = useState(stream ? 0 : lines.length);
  const [copied, setCopied] = useState(false);
  const done = count >= lines.length;

  useEffect(() => {
    if (done && !loop) return;
    const t = setTimeout(
      () => setCount((c) => (c >= lines.length ? 0 : c + 1)),
      count === 0 ? 400 : done ? HOLD_MS : LINE_MS,
    );
    return () => clearTimeout(t);
  }, [count, done, loop, lines.length]);

  const copy = useCallback(() => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }, [code]);

  return (
    <div className={`w-full overflow-hidden rounded-xl bg-surface shadow-[var(--kit-shadow-card)] ${className}`}>
      {/* header */}
      <div className="primitive-card-bar flex items-center justify-between border-b border-hairline">
        <span className="flex items-baseline gap-2">
          <span className="font-mono text-[12px] font-medium text-strong">{title}</span>
          <span className="text-[11.5px] text-faint">{language}</span>
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
      <pre className="max-h-[min(60vh,420px)] min-h-[137px] overflow-auto bg-page px-3 py-2.5 font-mono text-[11.5px] leading-[1.7]">
        {lines.slice(0, count).map((line, i) => (
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
