// Beautiful UI (beautifului.dev), MIT, see ./LICENSE. Restyled to Ripple tokens.
"use client";

import "./kit.css";

import { useEffect, useLayoutEffect, useRef, useState } from "react";


/* ─────────────────────────────────────────────────────────
 * PROMPT BAR
 * A composer with real controls: attach, @ data sources,
 * / commands, a model picker, dictation, and send.
 * Type @ or / to open the menus; ↑↓ + Enter to pick.
 * Variants: Rounded (card radius) · Pill (full radius).
 * ───────────────────────────────────────────────────────── */

function Icon({ children, size = 15, strokeWidth = 1.8 }: { children: React.ReactNode; size?: number; strokeWidth?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}

const GLYPHS: Record<string, React.ReactNode> = {
  clip: <path d="m21.4 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48" />,
  chart: <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />,
  layers: <g><path d="M12 2 2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5M2 12l10 5 10-5" /></g>,
  globe: <g><circle cx="12" cy="12" r="10" /><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /></g>,
};


export type Source = {
  key: string;
  name: string;
  desc: string;
  glyph?: string;
  attach?: boolean;
  connect?: boolean;
};

const SOURCES: Source[] = [
  { key: "attach", name: "Add files", desc: "Upload an RFC or contract", glyph: "clip", attach: true },
  { key: "graph", name: "Company graph", desc: "Decisions, promises, owners", glyph: "chart" },
  { key: "artifacts", name: "Artifacts", desc: "RFCs, contracts, Slack threads", glyph: "layers" },
  { key: "web", name: "Web search", desc: "Public docs and news", glyph: "globe" },
  { key: "slack", name: "Slack", desc: "Read channels and threads", glyph: "layers" },
  { key: "mail", name: "Email", desc: "Read and draft messages", glyph: "globe", connect: true },
];

export type MenuRow = { key: string; name: string; desc: string };

const COMMANDS: MenuRow[] = [
  { key: "impact", name: "/impact", desc: "Who does this change touch" },
  { key: "conflicts", name: "/conflicts", desc: "Promises that now disagree" },
  { key: "notify", name: "/notify", desc: "Draft notes for the unaware" },
  { key: "draft-email", name: "/draft-email", desc: "Write a note to a stakeholder" },
  { key: "summarize", name: "/summarize", desc: "Digest the thread so far" },
];

const MODELS = [
  { key: "sprinkles-5", name: "Deep", tag: "Flagship" },
  { key: "vanilla-1", name: "Fast", tag: "Basic" },
  { key: "freezer-burn", name: "Local", tag: "Offline" },
];

const FILES = ["rfc-14.md", "msa-v3.pdf", "launch-plan.csv"];
const DICTATION = "What does moving the launch to Nov 3 touch";

/* self-running demo: walk the @ menu, then the / menu, and repeat.
 * Any pointer or key interaction hands control to the user. */
const AUTO_STEPS: {
  draft: string;
  active?: number;
  connect?: boolean;
  modelOpen?: boolean;
  model?: string;
  hold: number;
}[] = [
  { draft: "", connect: false, model: "vanilla-1", hold: 1100 },
  { draft: "@", active: 0, hold: 900 },
  { draft: "@", active: 1, hold: 620 },
  { draft: "@", active: 4, hold: 620 },
  { draft: "@", active: 5, hold: 700 },
  { draft: "@", active: 5, connect: true, hold: 1000 },
  { draft: "", hold: 700 },
  { draft: "/", active: 0, hold: 900 },
  { draft: "/", active: 1, hold: 620 },
  { draft: "/", active: 3, hold: 1000 },
  { draft: "", hold: 800 },
  // open the model picker and upgrade to the flagship → rainbow sweep
  { draft: "", modelOpen: true, hold: 1200 },
  { draft: "", model: "sprinkles-5", hold: 2400 },
  { draft: "", hold: 900 },
];

/* the last @word or /word being typed, if any */
function parseToken(draft: string): { kind: "at" | "slash"; query: string; start: number } | null {
  const match = /(^|\s)([@/])([\w-]*)$/.exec(draft);
  if (!match) return null;
  return {
    kind: match[2] === "@" ? "at" : "slash",
    query: match[3].toLowerCase(),
    start: match.index + match[1].length,
  };
}

export default function PromptBar({
  variant = "Rounded",
  onSend,
  placeholder = "Write a message…",
  disabled = false,
  compact = false,
  sources = SOURCES,
  commands = COMMANDS,
  agents = [],
  agent,
  onAgentChange,
  remaining,
  exhausted = false,
  hero = false,
  menuBelow = false,
  autoFocus = false,
}: {
  variant?: string;
  /** Called with the trimmed draft and the picked agent on send. Providing it turns off the demo autoplay, the model picker and dictation. */
  onSend?: (text: string, opts: { agent?: string }) => void;
  placeholder?: string;
  /** Blocks sending (a reply is streaming); typing still works. */
  disabled?: boolean;
  /** Drop the demo's tall min-height and bottom padding. */
  compact?: boolean;
  /** `@` menu: data sources (after the agents). */
  sources?: Source[];
  /** `/` menu. Picking one inserts its name. */
  commands?: MenuRow[];
  /** `@` menu: agents that can answer. Picking one sets `agent` (shown as a chip). */
  agents?: MenuRow[];
  agent?: string;
  onAgentChange?: (key: string | undefined) => void;
  /** Live questions left today (null or undefined = unlimited, no note). */
  remaining?: number | null;
  /** The daily budget is spent: explains the cached tour. */
  exhausted?: boolean;
  /** Large landing composer: text on top, controls under it. */
  hero?: boolean;
  /** Open the @ and / menus below the composer (when it sits near the top of the page). */
  menuBelow?: boolean;
  autoFocus?: boolean;
}) {
  const live = !!onSend;
  const pill = variant === "Pill";
  const [draft, setDraft] = useState("");
  const [dismissed, setDismissed] = useState(false);
  const [plusOpen, setPlusOpen] = useState(false);
  const [modelOpen, setModelOpen] = useState(false);
  const [model, setModel] = useState(MODELS[1]);
  const [attachments, setAttachments] = useState<string[]>([]);
  const [connected, setConnected] = useState(false);
  const [active, setActive] = useState(0);
  const [listening, setListening] = useState(false);
  const [auto, setAuto] = useState(!live);
  const [autoStep, setAutoStep] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const [rowBox, setRowBox] = useState<{ top: number; height: number } | null>(null);
  const [engaged, setEngaged] = useState(false);
  const [modelBox, setModelBox] = useState<{ top: number; height: number } | null>(null);
  const [modelHovered, setModelHovered] = useState<number | null>(null);
  const controlsRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const measureRef = useRef<HTMLSpanElement>(null);
  const modelRef = useRef<HTMLButtonElement>(null);
  const rowRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const modelRowRefs = useRef<(HTMLButtonElement | null)[]>([]);

  /* hand control to the user: stop the demo loop, and when they aim at
   * the input itself, clear the demo's leftover draft for a clean start */
  const takeOver = (event: { target: EventTarget | null }) => {
    setAuto(false);
    if (auto && event.target === inputRef.current) setDraft("");
  };

  const token = dismissed ? null : parseToken(draft);
  const menu: "at" | "slash" | null = plusOpen ? "at" : token?.kind ?? null;
  const query = plusOpen ? "" : token?.query ?? "";

  const rows: MenuRow[] =
    menu === "at"
      ? [...agents, ...sources].filter((s) => s.name.toLowerCase().includes(query) || s.key.startsWith(query))
      : menu === "slash"
        ? commands.filter((c) => c.name.slice(1).startsWith(query))
        : [];
  const picked = agents.find((a) => a.key === agent);

  useEffect(() => {
    setActive(0);
    setEngaged(false);
  }, [menu, query]);

  /* a single highlight glides to the active row instead of each row
   * toggling its own background — matches the gliding pill in the nav */
  useLayoutEffect(() => {
    const target = rowRefs.current[active];
    if (target) setRowBox({ top: target.offsetTop, height: target.offsetHeight });
  }, [menu, query, active, connected, rows.length]);

  /* same gliding highlight in the model menu — floats to the hovered
   * row, falling back to the currently-selected model */
  const modelIndex = MODELS.findIndex((m) => m.key === model.key);
  useLayoutEffect(() => {
    if (!modelOpen) return;
    const target = modelRowRefs.current[modelHovered ?? modelIndex];
    if (target) setModelBox({ top: target.offsetTop, height: target.offsetHeight });
  }, [modelOpen, modelHovered, modelIndex]);

  useEffect(() => {
    if (!modelOpen) setModelHovered(null);
  }, [modelOpen]);

  const selectModel = (next: (typeof MODELS)[number]) => {
    setModel(next);
    setModelOpen(false);
  };

  /* autoplay: apply the current step, then advance after its hold */
  useEffect(() => {
    if (!auto) return;
    const step = AUTO_STEPS[autoStep % AUTO_STEPS.length];
    setDraft(step.draft);
    if (step.active !== undefined) setActive(step.active);
    if (step.connect !== undefined) setConnected(step.connect);
    if (step.modelOpen !== undefined) setModelOpen(step.modelOpen);
    if (step.model) {
      const next = MODELS.find((m) => m.key === step.model);
      if (next) selectModel(next);
    }
    const t = setTimeout(() => setAutoStep((s) => s + 1), step.hold);
    return () => clearTimeout(t);
  }, [auto, autoStep]);

  /* dictation resolves after a beat, like a real transcript landing */
  useEffect(() => {
    if (!listening) return;
    const t = setTimeout(() => {
      setDraft((current) => (current ? `${current.trimEnd()} ${DICTATION}` : DICTATION));
      setListening(false);
      inputRef.current?.focus();
    }, 2200);
    return () => clearTimeout(t);
  }, [listening]);

  /* Move wrapped text above the controls, then grow to a compact maximum. */
  useLayoutEffect(() => {
    const input = inputRef.current;
    const controls = controlsRef.current;
    const measure = measureRef.current;
    const modelButton = modelRef.current;
    if (!input || !controls || !measure) return;

    const fixedControlsWidth = 28 * (live ? 2 : 3) + (modelButton?.offsetWidth ?? 0);
    const inlineGaps = 4 * 4;
    const inlineInputWidth = controls.clientWidth - fixedControlsWidth - inlineGaps;
    const needsFullWidth = hero || draft.includes("\n") || measure.offsetWidth + 8 > inlineInputWidth;
    if (needsFullWidth !== expanded) {
      setExpanded(needsFullWidth);
    }

    const minHeight = hero ? 52 : 28;
    const maxHeight = hero ? 200 : 100;
    input.style.height = "0px";
    const contentHeight = input.scrollHeight;
    input.style.height = `${Math.min(Math.max(contentHeight, minHeight), maxHeight)}px`;
    input.style.overflowY = contentHeight > maxHeight ? "auto" : "hidden";
  }, [draft, expanded, hero, live]);

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  const closeMenus = () => {
    setPlusOpen(false);
    setModelOpen(false);
  };

  const pick = (row: { key: string; name: string }) => {
    const source = sources.find((s) => s.key === row.key);
    if (menu === "at" && agents.some((a) => a.key === row.key)) {
      onAgentChange?.(row.key);
      if (token) setDraft(draft.slice(0, token.start));
    } else if (source?.attach) {
      setAttachments((current) => [...current, FILES[current.length % FILES.length]]);
      if (token) setDraft(draft.slice(0, token.start));
    } else if (menu === "at") {
      setDraft(`${token ? draft.slice(0, token.start) : draft}@${row.name} `);
    } else {
      setDraft(`${token ? draft.slice(0, token.start) : draft}${row.name} `);
    }
    setPlusOpen(false);
    setDismissed(false);
    inputRef.current?.focus();
  };

  const canSend = !disabled && (draft.trim().length > 0 || attachments.length > 0);
  const send = () => {
    if (!canSend) return;
    onSend?.(draft.trim(), { agent });
    setDraft("");
    setAttachments([]);
    closeMenus();
  };

  return (
    <div
      className={`flex w-full flex-col justify-end ${compact ? "" : "min-h-[384px] max-w-105 pb-8"}`}
      onPointerDownCapture={takeOver}
      onKeyDownCapture={takeOver}
    >
      {/* composer is the anchor — menus grow up from its top edge */}
      <div className="relative">
      {/* ── @ / slash menu ─────────────────────────────── */}
      {menu && (
        <div
          onMouseLeave={() => setEngaged(false)}
          role="listbox"
          aria-label={menu === "at" ? "Agents and sources" : "Commands"}
          className={`absolute inset-x-0 z-20 max-h-[min(360px,50vh)] overflow-y-auto rounded-[12px] bg-surface p-1 shadow-[var(--kit-shadow-raised)] ${menuBelow ? "top-full mt-2" : "bottom-full mb-2"}`}
          style={{ animation: "pop-in 180ms cubic-bezier(0.23,1,0.32,1) both", transformOrigin: menuBelow ? "top center" : "bottom center" }}
        >
          {/* single gliding highlight — appears once a row is hovered */}
          <span
            aria-hidden
            className="pointer-events-none absolute inset-x-1 rounded-[6px] bg-raised"
            style={{
              top: rowBox?.top ?? 0,
              height: rowBox?.height ?? 0,
              opacity: rowBox && engaged && rows.length > 0 ? 1 : 0,
              transition:
                "top 220ms cubic-bezier(0.23,1,0.32,1), height 220ms cubic-bezier(0.23,1,0.32,1), opacity 150ms ease",
            }}
          />
          {rows.map((row, i) => {
            const source = menu === "at" ? sources.find((s) => s.key === row.key) : undefined;
            const isAgent = menu === "at" && agents.some((a) => a.key === row.key);
            return (
              <button
                key={row.key}
                type="button"
                ref={(el) => {
                  rowRefs.current[i] = el;
                }}
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => {
                  setActive(i);
                  setEngaged(true);
                }}
                onClick={() => pick(row)}
                role="option"
                aria-selected={i === active}
                className="relative z-10 flex h-9 w-full items-center gap-2.5 rounded-[6px] px-2 text-left"
              >
                {isAgent && (
                  <span aria-hidden className="grid size-5.5 shrink-0 place-items-center rounded-full bg-raised font-mono text-[10px] font-medium text-body">{row.name[0]}</span>
                )}
                {source && (
                  <span className="flex size-5.5 shrink-0 items-center justify-center text-body">
                    <Icon size={15}>{GLYPHS[source.glyph ?? "clip"]}</Icon>
                  </span>
                )}
                <span className="shrink-0 text-[12.5px] font-medium text-strong">
                  {row.name}
                </span>
                <span className="min-w-0 flex-1 truncate text-[12px] text-faint">{row.desc}</span>
                {source?.connect && (
                  <span
                    role="button"
                    tabIndex={-1}
                    onClick={(event) => {
                      event.stopPropagation();
                      setConnected((current) => !current);
                    }}
                    className={`shrink-0 text-[12px] font-medium transition-colors duration-100 ${
                      connected ? "text-covered" : "text-ripple hover:underline"
                    }`}
                  >
                    {connected ? "Connected" : "Connect"}
                  </span>
                )}
              </button>
            );
          })}
          {rows.length === 0 && (
            <div className="flex h-9 items-center px-2 text-[12px] text-faint">
              No matches for “{query}”
            </div>
          )}
          <div className="mt-1 border-t border-hairline px-2 pt-1.5 pb-1 text-[11px] text-faint">
            {menu === "at" ? (agents.length ? "Pick who answers · Esc to close" : "Type to search sources & files") : "Type to search commands"}
          </div>
        </div>
      )}

      {/* ── model menu ─────────────────────────────────── */}
      {modelOpen && (
        <div
          onMouseLeave={() => setModelHovered(null)}
          className="absolute right-0 bottom-full z-10 mb-2 w-44 rounded-[10px] bg-surface p-1 shadow-[var(--kit-shadow-raised)]"
          style={{ animation: "pop-in 180ms cubic-bezier(0.23,1,0.32,1) both", transformOrigin: "bottom right" }}
        >
          {/* single gliding highlight — floats to the hovered / selected row */}
          <span
            aria-hidden
            className="pointer-events-none absolute inset-x-1 rounded-[6px] bg-raised"
            style={{
              top: modelBox?.top ?? 0,
              height: modelBox?.height ?? 0,
              opacity: modelBox && modelHovered !== null ? 1 : 0,
              transition:
                "top 220ms cubic-bezier(0.23,1,0.32,1), height 220ms cubic-bezier(0.23,1,0.32,1), opacity 150ms ease",
            }}
          />
          {MODELS.map((m, i) => (
            <button
              key={m.key}
              type="button"
              ref={(el) => {
                modelRowRefs.current[i] = el;
              }}
              onMouseDown={(event) => event.preventDefault()}
              onMouseEnter={() => setModelHovered(i)}
              onClick={() => {
                selectModel(m);
                inputRef.current?.focus();
              }}
              className="relative z-10 flex h-7.5 w-full items-center gap-2 rounded-[6px] px-2 text-left"
            >
              <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium text-strong">{m.name}</span>
              <span className="shrink-0 text-[11px] text-faint">{m.tag}</span>
              <span className={`shrink-0 text-strong ${m.key === model.key ? "" : "invisible"}`}>
                <Icon size={13} strokeWidth={2.5}><path d="M20 6L9 17l-5-5" /></Icon>
              </span>
            </button>
          ))}
        </div>
      )}

      {/* ── composer ───────────────────────────────────── */}
      <div
        className={`relative isolate flex flex-col gap-1.5 overflow-hidden border border-hairline bg-surface p-1.5 shadow-[var(--kit-shadow-card)] transition-[border-color,border-radius] duration-150 focus-within:border-hairline ${
          pill ? (attachments.length > 0 || expanded ? "rounded-[24px]" : "rounded-full") : hero ? "rounded-[20px] p-2.5" : "rounded-[14px]"
        }`}
      >
        <span
          ref={measureRef}
          aria-hidden="true"
          className="pointer-events-none absolute invisible whitespace-pre text-[13px] leading-[18px]"
        >
          {draft}
        </span>

        {(attachments.length > 0 || picked) && (
          <div className={`flex flex-wrap gap-1.5 pt-0.5 ${pill ? "px-1" : "px-0.5"}`}>
            {picked && (
              <span className="flex h-6.5 items-center gap-1.5 rounded-full bg-raised py-1 pr-1 pl-2 text-[12px] font-medium text-strong shadow-[var(--kit-shadow-hairline)]" style={{ animation: "pop-in 200ms cubic-bezier(0.23,1,0.32,1) both" }}>
                <span className="text-faint">@</span>
                {picked.name}
                <button type="button" aria-label={`Stop asking ${picked.name}`} onClick={() => onAgentChange?.(undefined)} className="flex size-4 items-center justify-center rounded-full text-faint hover:bg-overlay/70 hover:text-strong">
                  <Icon size={10} strokeWidth={2.5}><path d="M18 6L6 18M6 6l12 12" /></Icon>
                </button>
              </span>
            )}
            {attachments.map((file, i) => (
              <span
                key={`${file}-${i}`}
                className={`flex h-6.5 items-center gap-1.5 bg-raised py-1 pr-1 pl-1.5 text-[11.5px] text-body shadow-[var(--kit-shadow-hairline)] ${
                  pill ? "rounded-full" : "rounded-md"
                }`}
                style={{ animation: "pop-in 200ms cubic-bezier(0.23,1,0.32,1) both" }}
              >
                <Icon size={12}><g><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /></g></Icon>
                <span className="max-w-36 truncate">{file}</span>
                <button
                  type="button"
                  aria-label={`Remove ${file}`}
                  onClick={() => setAttachments((current) => current.filter((_, j) => j !== i))}
                  className={`flex size-4 items-center justify-center text-faint transition-colors duration-100 hover:bg-overlay/70 hover:text-strong ${
                    pill ? "rounded-full" : "rounded-[4px]"
                  }`}
                >
                  <Icon size={10} strokeWidth={2.5}><path d="M18 6L6 18M6 6l12 12" /></Icon>
                </button>
              </span>
            ))}
          </div>
        )}

        <div
          ref={controlsRef}
          className={`grid items-end gap-x-1 gap-y-1.5 ${
            live
              ? expanded ? "grid-cols-[minmax(0,1fr)_28px]" : "grid-cols-[28px_minmax(0,1fr)_28px]"
              : expanded
                ? "grid-cols-[minmax(0,1fr)_auto_28px_28px]"
                : "grid-cols-[28px_minmax(0,1fr)_auto_28px_28px]"
          }`}
        >
          <button
            type="button"
            aria-label={agents.length ? "Pick an agent" : "Add attachments and sources"}
            aria-expanded={plusOpen}
            onClick={() => {
              setModelOpen(false);
              setPlusOpen((current) => !current);
              inputRef.current?.focus();
            }}
            className={`flex size-7 shrink-0 items-center justify-center justify-self-start text-faint transition-[background-color,color,transform] duration-150 hover:bg-raised hover:text-strong active:scale-[0.94] ${
              pill ? "rounded-full" : "rounded-[8px]"
            } ${plusOpen ? "bg-raised text-strong" : ""} ${expanded ? "col-start-1 row-start-2" : "col-start-1 row-start-1"}`}
          >
            <Icon size={16} strokeWidth={2}><path d="M12 5v14M5 12h14" /></Icon>
          </button>

          <textarea
            ref={inputRef}
            rows={1}
            value={draft}
            onChange={(event) => {
              setDraft(event.target.value);
              setDismissed(false);
              setPlusOpen(false);
            }}
            onKeyDown={(event) => {
              if (menu && rows.length > 0) {
                if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                  event.preventDefault();
                  setEngaged(true);
                  setActive((current) => (current + (event.key === "ArrowDown" ? 1 : rows.length - 1)) % rows.length);
                  return;
                }
                if ((event.key === "Enter" && !event.shiftKey) || event.key === "Tab") {
                  event.preventDefault();
                  pick(rows[active]);
                  return;
                }
              }
              if (event.key === "Escape") {
                setDismissed(true);
                closeMenus();
                return;
              }
              if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                event.preventDefault();
                send();
              }
            }}
            placeholder={listening ? "Listening…" : placeholder}
            aria-label="Prompt"
            className={`min-h-7 min-w-0 w-full resize-none bg-transparent px-1 py-[5px] ${hero ? "px-2 pt-2 text-[15px] leading-[22px]" : "text-[13px] leading-[18px]"} text-strong outline-none [overflow-wrap:anywhere] placeholder:text-faint ${
              expanded ? "col-span-full col-start-1 row-start-1" : "col-start-2 row-start-1"
            }`}
          />

          {/* model picker (demo only) */}
          {!live && <button
            ref={modelRef}
            type="button"
            aria-expanded={modelOpen}
            aria-label="Choose model"
            onClick={() => {
              setPlusOpen(false);
              setModelOpen((current) => !current);
            }}
            className={`flex h-7 shrink-0 items-center gap-1 px-1.5 text-[12px] font-medium text-body transition-colors duration-150 hover:bg-raised hover:text-strong ${
              pill ? "rounded-full" : "rounded-[8px]"
            } ${expanded ? "col-start-2 row-start-2" : "col-start-3 row-start-1"}`}
          >
            {model.name}
            <span className="text-faint">
              <Icon size={11} strokeWidth={2.4}><path d="M6 9l6 6 6-6" /></Icon>
            </span>
          </button>}

          {/* dictation (demo only) */}
          {!live && <button
            type="button"
            aria-label={listening ? "Stop dictation" : "Start dictation"}
            aria-pressed={listening}
            onClick={() => setListening((current) => !current)}
            className={`flex size-7 shrink-0 items-center justify-center transition-[background-color,color,transform] duration-150 active:scale-[0.94] ${
              pill ? "rounded-full" : "rounded-[8px]"
            } ${listening ? "bg-ripple-soft text-ripple" : "text-faint hover:bg-raised hover:text-strong"} ${
              expanded ? "col-start-3 row-start-2" : "col-start-4 row-start-1"
            }`}
          >
            {listening ? (
              <span className="flex h-3.5 items-center gap-[2.5px]">
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className="w-[2.5px] rounded-full bg-current"
                    style={{ height: "100%", animation: `eq-bounce 900ms ease-in-out ${i * 150}ms infinite` }}
                  />
                ))}
              </span>
            ) : (
              <Icon size={15} strokeWidth={2}><g><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" /><path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v3" /></g></Icon>
            )}
          </button>}

          {/* send — tactile square (round in the pill variant) */}
          <button
            type="button"
            aria-label="Send"
            disabled={!canSend}
            onClick={send}
            className={`flex size-7 shrink-0 items-center justify-center transition-[background-color,color,transform] duration-200 enabled:active:scale-[0.94] ${
              pill ? "rounded-full" : "rounded-[8px]"
            } ${live ? (expanded ? "col-start-2 row-start-2" : "col-start-3 row-start-1") : expanded ? "col-start-4 row-start-2" : "col-start-5 row-start-1"}`}
            style={{
              background: canSend ? "var(--strong)" : "var(--hairline)",
              color: canSend ? "var(--surface)" : "var(--body)",
            }}
          >
            <Icon size={16} strokeWidth={2.4}><path d="M12 19V5M5 12l7-7 7 7" /></Icon>
          </button>
        </div>
      </div>
      </div>
      {live && (exhausted || typeof remaining === "number") && (
        <p className="mt-2 px-1 text-center text-[11.5px] text-faint" aria-live="polite">
          {exhausted
            ? "Live questions are used up for today. Starter prompts and agent samples still answer from the cached tour."
            : `${remaining} ${remaining === 1 ? "question" : "questions"} left today · starter prompts are free`}
        </p>
      )}
    </div>
  );
}
