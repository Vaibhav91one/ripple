// Beautiful UI (beautifului.dev), MIT, see ./LICENSE. Restyled to Ripple tokens.
"use client";

import "./kit.css";

import { useEffect, useState } from "react";

/* ─────────────────────────────────────────────────────────
 * STREAMING TEXT
 * Words resolve out of blur, inline citations appear in
 * context, then actions and follow-up prompts become usable.
 * ───────────────────────────────────────────────────────── */

const WORD_MS = 55;
const HOLD_MS = 3400;

export type SourceRef = { name: string; domain: string; href?: string; onClick?: () => void };
export type Token = { text: string; cite?: SourceRef };

const SOURCES = [
  { name: "RFC-14", domain: "RFC-14 §2", href: "#" },
  { name: "Acme MSA", domain: "MSA v3 §7.2", href: "#" },
  { name: "Launch plan", domain: "Slack #launch", href: "#" },
];

const TOKENS: Token[] = [
  ..."Moving the launch to Nov 3 reaches 11 people, and Acme was promised Oct 28 in clause 7.2."
    .split(" ")
    .map((text) => ({ text })),
  { text: "", cite: SOURCES[0] },
  ..."Legal and Sales have not been told yet."
    .split(" ")
    .map((text) => ({ text })),
];

const FOLLOW_UPS = [
  "Who was never told",
  "Draft the note to Legal",
];


function SourceChip({ source }: { source: SourceRef }) {
  return (
    <a
      href={source.href ?? "#"}
      target="_blank"
      rel="noreferrer"
      onClick={(e) => {
        if (source.onClick) {
          e.preventDefault();
          source.onClick();
        }
      }}
      className="ml-0 mr-1 inline-flex h-4.5 translate-y-[-1px] items-center gap-1 rounded-[5px]
        bg-page pr-[3px] pl-[3px] align-middle font-mono text-[10.5px] text-body shadow-[var(--kit-shadow-hairline)]
        transition-colors duration-150 hover:bg-raised hover:text-strong"
      style={{ animation: "pop-in 250ms cubic-bezier(0.23,1,0.32,1) both" }}
    >
      <span aria-hidden className="grid size-3 place-items-center rounded-[3px] bg-ripple-soft text-[8px] font-bold text-ripple">{source.name[0]}</span>
      <span>{source.domain}</span>
    </a>
  );
}

const ACTION_ICONS: React.ReactNode[] = [
  <g key="copy"><rect x="9" y="9" width="12" height="12" rx="2.5" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></g>,
  <path key="retry" d="M21 12a9 9 0 1 1-2.64-6.36M21 3v6h-6" />,
  <path key="up" d="M7 10v12M15 5.88L14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88z" />,
  <path key="down" d="M17 14V2M9 18.12L10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.76a2 2 0 0 0-1.79 1.11L12 22a3.13 3.13 0 0 1-3-3.88z" />,
];

export default function StreamingText({
  tokens = TOKENS,
  sources = SOURCES,
  followUps = FOLLOW_UPS,
  streaming,
  showActions = true,
}: {
  tokens?: Token[];
  sources?: SourceRef[];
  followUps?: string[];
  /** Controlled mode: tokens arrive from outside; no replay loop. */
  streaming?: boolean;
  showActions?: boolean;
}) {
  const controlled = streaming !== undefined;
  const [replay, setCount] = useState(0);
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const count = controlled ? tokens.length : replay;
  const done = controlled ? !streaming : count >= tokens.length;

  useEffect(() => {
    if (controlled) return;
    const t = setTimeout(
      () => setCount((c) => (c >= tokens.length ? 0 : c + 1)),
      done ? HOLD_MS : WORD_MS,
    );
    return () => clearTimeout(t);
  }, [count, done, controlled, tokens.length]);

  return (
    <div className={`w-full ${controlled ? "" : "min-h-[15.5rem] max-w-95"}`}>
      <p className="text-[13px] leading-relaxed text-strong">
        {tokens.slice(0, count).map((token, i) =>
          token.cite ? (
            <SourceChip key={i} source={token.cite} />
          ) : (
            <span
              key={i}
              className="inline [will-change:filter,opacity]"
              style={{ animation: "stream-in 420ms cubic-bezier(0.22,0.61,0.25,1) both" }}
            >
              {token.text}{" "}
            </span>
          ),
        )}
        {!done && (
          <span
            className="ml-0.5 inline-block h-3 w-0.5 translate-y-0.5 rounded-full bg-strong"
            style={{ animation: "fade-in 150ms ease-out both" }}
          />
        )}
      </p>

      {showActions && sources.length > 0 && (
      <>
      {/* action icons row */}
      <div
        className="mt-2 flex items-center gap-0.5 transition-opacity duration-400"
        style={{ opacity: done ? 1 : 0, pointerEvents: done ? "auto" : "none" }}
      >
        {ACTION_ICONS.map((icon, i) => (
          <button
            key={i}
            type="button"
            aria-label="Action"
            className="flex size-6 items-center justify-center rounded-[6px] text-faint
              transition-colors duration-100 hover:bg-overlay hover:text-body"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              {icon}
            </svg>
          </button>
        ))}
        <button
          type="button"
          aria-expanded={sourcesOpen}
          onClick={() => setSourcesOpen((current) => !current)}
          className="ml-1.5 flex items-center gap-1.5 rounded-[6px] px-1 py-0.5 text-left transition-colors duration-150 hover:bg-raised"
        >
          <span className="flex -space-x-1">
            {sources.map((source) => (
              <span key={source.domain} aria-hidden className="grid size-3.5 place-items-center rounded-full bg-ripple-soft text-[8px] font-bold text-ripple shadow-[0_0_0_1.5px_var(--page)]">{source.name[0]}</span>
            ))}
          </span>
          <span className="text-[12px] text-body">{sources.length} {sources.length === 1 ? "source" : "sources"}</span>
        </button>
      </div>

      <div
        className="grid transition-[grid-template-rows,opacity] duration-300"
        style={{
          gridTemplateRows: done && sourcesOpen ? "1fr" : "0fr",
          opacity: done && sourcesOpen ? 1 : 0,
          transitionTimingFunction: "cubic-bezier(0.23, 1, 0.32, 1)",
        }}
      >
        <div className="overflow-hidden">
          <div className="mt-1.5 flex flex-col rounded-[10px] bg-page p-1 shadow-[var(--kit-shadow-hairline)]">
            {sources.map((source) => (
              <a
                key={source.domain}
                href={source.href ?? "#"}
                target="_blank"
                rel="noreferrer"
                onClick={(e) => {
                  if (source.onClick) {
                    e.preventDefault();
                    source.onClick();
                  }
                }}
                className="flex items-center gap-2 rounded-[6px] px-1.5 py-1 text-[12px] text-body transition-colors duration-150 hover:bg-raised hover:text-strong"
              >
                <span aria-hidden className="grid size-4 place-items-center rounded-[4px] bg-ripple-soft text-[9px] font-bold text-ripple">{source.name[0]}</span>
                <span className="animated-underline">{source.name}</span>
                <span className="ml-auto font-mono text-[10.5px] text-faint">{source.domain}</span>
              </a>
            ))}
          </div>
        </div>
      </div>

      </>
      )}

      {/* follow-ups */}
      {followUps.length > 0 && (
      <div
        className="mt-2.5 transition-opacity duration-400"
        style={{ opacity: done ? 1 : 0, pointerEvents: done ? "auto" : "none" }}
      >
        <p className="text-[12px] font-medium text-body">Follow-ups</p>
        <div className="mt-0.5 flex flex-col">
          {followUps.map((text, i) => (
            <button
              key={text}
              className="-mx-1.5 flex items-center gap-2 rounded-[7px] border-b border-hairline
                px-1.5 py-1.5 text-left text-[12.5px] text-strong transition-colors
                duration-100 hover:bg-overlay"
              style={
                done
                  ? { animation: `fade-up 350ms cubic-bezier(0.23,1,0.32,1) ${i * 90}ms both` }
                  : { opacity: 0 }
              }
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--faint)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                <path d="M9 10l-5 5 5 5" />
                <path d="M20 4v7a4 4 0 0 1-4 4H4" />
              </svg>
              {text}
            </button>
          ))}
        </div>
      </div>
      )}
    </div>
  );
}
