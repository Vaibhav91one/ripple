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

export type SourceRef = { name: string; domain: string; /** Citation number: renders a numbered marker instead of the name chip. */ n?: number; /** Full label for title/aria when `domain` is a short display form. */ title?: string; href?: string; onClick?: () => void };
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
  if (source.n !== undefined)
    return (
      <button
        type="button"
        title={source.title ?? source.name}
        aria-label={`Source ${source.n}: ${source.title ?? source.name}`}
        onClick={source.onClick}
        className="mr-1 inline-grid h-[18px] min-w-[18px] translate-y-[-2px] place-items-center rounded-full bg-raised px-1 align-middle font-mono text-2xs font-medium text-body shadow-[var(--kit-shadow-hairline)] transition-colors duration-150 hover:bg-ripple-soft hover:text-ripple-ink"
        style={{ animation: "pop-in 250ms cubic-bezier(0.23,1,0.32,1) both" }}
      >
        {source.n}
      </button>
    );
  return (
    <a
      href={source.href ?? "#"}
      target="_blank"
      rel="noreferrer"
      title={source.title}
      aria-label={source.title}
      onClick={(e) => {
        if (source.onClick) {
          e.preventDefault();
          source.onClick();
        }
      }}
      className="ml-0 mr-1 inline-flex h-4.5 translate-y-[-1px] items-center gap-1 rounded-md
        bg-page pr-[3px] pl-[3px] align-middle font-mono text-2xs text-body shadow-[var(--kit-shadow-hairline)]
        transition-colors duration-150 hover:bg-raised hover:text-strong"
      style={{ animation: "pop-in 250ms cubic-bezier(0.23,1,0.32,1) both" }}
    >
      <span aria-hidden className="grid size-3 place-items-center rounded-sm bg-ripple-soft text-[8px] font-bold text-ripple-ink">{source.name[0]}</span>
      <span className="max-w-48 truncate">{source.domain}</span>
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
  onCopy,
  onRetry,
  textClassName = "text-sm leading-relaxed",
}: {
  tokens?: Token[];
  sources?: SourceRef[];
  followUps?: string[];
  /** Controlled mode: tokens arrive from outside; no replay loop. */
  streaming?: boolean;
  showActions?: boolean;
  /** Real actions: when either is set, the row shows only Copy and Regenerate. */
  onCopy?: () => void;
  onRetry?: () => void;
  textClassName?: string;
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
      <p className={`${textClassName} text-strong [overflow-wrap:anywhere]`}>
        {tokens.slice(0, count).map((token, i) =>
          token.cite ? (
            <SourceChip key={i} source={token.cite} />
          ) : (
            <span
              key={i}
              className="inline"
              style={{ animation: "stream-in 240ms cubic-bezier(0.22,0.61,0.25,1) backwards" }}
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

      {showActions && (sources.length > 0 || onCopy || onRetry) && (
      <>
      {/* action icons row */}
      <div
        inert={!done}
        className="mt-2 flex items-center gap-0.5 transition-opacity duration-400"
        style={{ opacity: done ? 1 : 0, pointerEvents: done ? "auto" : "none" }}
      >
        {(onCopy || onRetry ? ([[ACTION_ICONS[0], "Copy", onCopy], [ACTION_ICONS[1], "Regenerate", onRetry]] as const).filter((a) => a[2]) : ACTION_ICONS.map((icon) => [icon, "Action", undefined] as const)).map(([icon, label, act], i) => (
          <button
            key={i}
            type="button"
            aria-label={label}
            title={label === "Action" ? undefined : label}
            onClick={act}
            className="flex size-6 items-center justify-center rounded-chip text-faint
              transition-colors duration-100 hover:bg-overlay hover:text-body"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              {icon}
            </svg>
          </button>
        ))}
        {sources.length > 0 && <button
          type="button"
          aria-expanded={sourcesOpen}
          onClick={() => setSourcesOpen((current) => !current)}
          className="ml-1.5 flex items-center gap-1.5 rounded-chip px-1 py-0.5 text-left transition-colors duration-150 hover:bg-raised"
        >
          <span className="flex -space-x-1">
            {sources.slice(0, 5).map((source) => (
              <span key={source.domain} aria-hidden className="grid size-3.5 place-items-center rounded-full bg-ripple-soft text-[8px] font-bold text-ripple-ink shadow-[0_0_0_1.5px_var(--page)]">{source.n ?? source.name[0]}</span>
            ))}
            {sources.length > 5 && <span aria-hidden className="grid h-3.5 place-items-center rounded-full bg-raised px-1 text-[8px] font-bold text-body shadow-[0_0_0_1.5px_var(--page)]">+{sources.length - 5}</span>}
          </span>
          <span className="whitespace-nowrap text-xs text-body">Sources ({sources.length})</span>
        </button>}
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
          <div className="mt-1.5 flex flex-col rounded-control bg-page p-1 shadow-[var(--kit-shadow-hairline)]">
            {sources.map((source) => {
              const Row = source.onClick ? "button" : "a";
              return (
              <Row
                key={source.domain}
                {...(source.onClick ? { type: "button" as const, onClick: source.onClick } : { href: source.href ?? "#", target: "_blank", rel: "noreferrer" })}
                className="flex w-full items-center gap-2 rounded-chip px-1.5 py-1 text-left text-xs text-body transition-colors duration-150 hover:bg-raised hover:text-strong"
              >
                <span aria-hidden className="grid size-4 shrink-0 place-items-center rounded-md bg-ripple-soft text-[9px] font-bold text-ripple-ink">{source.n ?? source.name[0]}</span>
                <span className="animated-underline min-w-0 truncate" title={source.name}>{source.name}</span>
                <span className="ml-auto shrink-0 whitespace-nowrap font-mono text-2xs text-faint">{source.domain}</span>
              </Row>
              );
            })}
          </div>
        </div>
      </div>

      </>
      )}

      {/* follow-ups */}
      {followUps.length > 0 && (
      <div
        inert={!done}
        className="mt-2.5 transition-opacity duration-400"
        style={{ opacity: done ? 1 : 0, pointerEvents: done ? "auto" : "none" }}
      >
        <p className="text-xs font-medium text-body">Follow-ups</p>
        <div className="mt-0.5 flex flex-col">
          {followUps.map((text, i) => (
            <button
              key={text}
              className="-mx-1.5 flex items-center gap-2 rounded-chip border-b border-hairline
                px-1.5 py-1.5 text-left text-sm text-strong transition-colors
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
