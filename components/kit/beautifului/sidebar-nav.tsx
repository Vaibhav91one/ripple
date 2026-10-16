// Beautiful UI (beautifului.dev), MIT, see ./LICENSE. Restyled to Ripple tokens.
"use client";

import "./kit.css";

import { useLayoutEffect, useRef, useState } from "react";

/* ─────────────────────────────────────────────────────────
 * SIDEBAR NAV
 * Workspace navigation with direct selection and search.
 * ───────────────────────────────────────────────────────── */

export type SidebarItem = {
  key: string;
  label: string;
  section: string;
  /** icon name, see Icon below */
  icon?: string;
  /** trailing content, e.g. count pills */
  badge?: React.ReactNode;
  plus?: boolean;
};

export const SAMPLE_ITEMS: SidebarItem[] = [
  { key: "activity", icon: "activity", label: "Overview", section: "Workspace" },
  { key: "tasks", icon: "tasks", label: "Open conflicts", section: "Workspace", badge: 4 },
  { key: "dashboard", icon: "dashboard", label: "Gaps", section: "Workspace" },
  { key: "spaces", icon: "spaces", label: "Decisions", section: "Objects", plus: true },
  { key: "analytics", icon: "analytics", label: "Promises", section: "Objects" },
];

function Icon({ kind }: { kind: string }) {
  const p: Record<string, React.ReactNode> = {
    activity: <path d="M22 12h-4l-3 9L9 3l-3 9H2" />,
    tasks: <g><path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></g>,
    spaces: <g><path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5M2 12l10 5 10-5" /></g>,
    dashboard: <g><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></g>,
    analytics: <g><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></g>,
  };
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {p[kind]}
    </svg>
  );
}

export type SidebarNavProps = {
  items?: SidebarItem[];
  /** controlled selection; omit for internal state */
  active?: string;
  onSelect?: (key: string) => void;
  /** workspace row; null hides it */
  header?: React.ReactNode | null;
  /** replaces the quick-search field; null hides it */
  search?: React.ReactNode | null;
  /** accent action row; null hides it */
  action?: { label: string; onClick?: () => void } | null;
  className?: string;
};

const SAMPLE_HEADER = (
  <button
    type="button"
    className="mb-2 flex w-full items-center gap-2.5 rounded-lg p-1.5 text-left
      transition-[background-color,transform] duration-100 hover:bg-raised active:scale-[0.96]"
  >
    <span className="flex size-8 shrink-0 items-center justify-center rounded-[8px] bg-strong text-[13px] font-semibold text-surface">
      R
    </span>
    <span className="min-w-0 flex-1">
      <span className="block truncate text-[13px] font-medium leading-tight text-strong">Ripple</span>
      <span className="block truncate text-[11px] leading-tight text-faint">Acme workspace</span>
    </span>
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--faint)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 15l5 5 5-5M7 9l5-5 5 5" />
    </svg>
  </button>
);

export default function SidebarNav({
  items = SAMPLE_ITEMS,
  active: controlled,
  onSelect,
  header = SAMPLE_HEADER,
  search,
  action = { label: "New task" },
  className = "w-60 rounded-xl bg-surface p-2 shadow-[var(--kit-shadow-raised)]",
}: SidebarNavProps = {}) {
  const [inner, setInner] = useState("tasks");
  const active = controlled ?? inner;
  const setActive = (key: string) => (setInner(key), onSelect?.(key));
  const [hovered, setHovered] = useState<string | null>(null);
  const [box, setBox] = useState<{ top: number; height: number } | null>(null);
  const [query, setQuery] = useState("");
  const sections = [...new Set(items.map((i) => i.section))];
  const navRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  useLayoutEffect(() => {
    const container = navRef.current;
    const target = itemRefs.current[hovered ?? active];
    if (!container || !target) return;

    const containerRect = container.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    setBox({
      top: targetRect.top - containerRect.top,
      height: targetRect.height,
    });
  }, [hovered, active, items]);

  return (
    <div className={className}>
      {/* workspace row */}
      {header}

      {/* quick search */}
      {search !== undefined ? search : <label className="mb-1 flex h-8 items-center gap-2 rounded-lg bg-page px-2.5 shadow-[var(--kit-shadow-hairline)]">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--faint)" strokeWidth="2" strokeLinecap="round">
          <circle cx="11" cy="11" r="7" />
          <path d="M21 21l-4.3-4.3" />
        </svg>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Quick search"
          className="min-w-0 flex-1 bg-transparent text-[12.5px] text-strong outline-none placeholder:text-faint"
        />
        <kbd className="flex size-4.5 items-center justify-center rounded-[5px] bg-surface text-[10px] text-faint shadow-[var(--kit-shadow-hairline)]">
          /
        </kbd>
      </label>}

      {/* accent action */}
      {action && <button
        type="button"
        onClick={action.onClick}
        className="mb-2 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-[13px]
          font-medium text-ripple transition-[background-color,transform] duration-100 hover:bg-ripple-soft active:scale-[0.96]"
      >
        <span className="min-w-0 flex-1 truncate text-left">{action.label}</span>
        <span className="flex size-4 shrink-0 items-center justify-center rounded-full bg-ripple text-page">
          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
        </span>
      </button>}

      {/* items */}
      <div
        ref={navRef}
        onMouseLeave={() => setHovered(null)}
        className="relative flex flex-col gap-2"
      >
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-0 rounded-[7px] bg-raised"
          style={{
            top: box?.top ?? 0,
            height: box?.height ?? 0,
            opacity: box ? 1 : 0,
            transition:
              "top 220ms cubic-bezier(0.23,1,0.32,1), height 220ms cubic-bezier(0.23,1,0.32,1), opacity 150ms ease",
          }}
        />
        {sections.map((section) => (
          <div key={section}>
            <div className="px-2 pb-1 pt-1 text-[10.5px] font-medium uppercase tracking-[0.08em] text-faint">
              {section}
            </div>
            <div className="flex flex-col gap-px">
              {items.filter((item) => item.section === section).map((item) => {
                const isActive = item.key === active;
                return (
                  <button
                    key={item.key}
                    ref={(el) => {
                      itemRefs.current[item.key] = el;
                    }}
                    type="button"
                    onMouseEnter={() => setHovered(item.key)}
                    onFocus={() => setHovered(item.key)}
                    onBlur={() => setHovered(null)}
                    onClick={() => setActive(item.key)}
                    aria-current={isActive ? "page" : undefined}
                    className="group relative z-10 flex w-full items-center gap-2 rounded-[7px] px-2 py-1.5 text-left
                      transition-[color,transform] duration-150 active:scale-[0.96]"
                  >
                    <span className={isActive ? "text-strong" : "text-faint"}>
                      <Icon kind={item.icon ?? "spaces"} />
                    </span>
                    <span
                      className={`min-w-0 flex-1 truncate text-[13px] transition-colors duration-150
                        ${isActive ? "font-medium text-strong" : "text-body"}`}
                    >
                      {item.label}
                    </span>
                    {typeof item.badge === "number" ? (
                      <span
                        className={`flex h-4.5 min-w-4.5 items-center justify-center rounded-full px-1 text-[10.5px] font-semibold tabular-nums ${
                          isActive ? "bg-surface text-body shadow-[var(--kit-shadow-hairline)]" : "bg-ripple-soft text-ripple"
                        }`}
                        style={{ animation: "pop-in 250ms cubic-bezier(0.23,1,0.32,1) both" }}
                      >
                        {item.badge}
                      </span>
                    ) : (
                      item.badge
                    )}
                    {item.plus && (
                      <span
                        className="flex size-4.5 items-center justify-center rounded-[5px] text-faint opacity-0
                          transition-[background-color,color,opacity] duration-100 group-hover:opacity-100 hover:bg-overlay/70 hover:text-body"
                        style={isActive ? { opacity: 1 } : undefined}
                      >
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                          <path d="M12 5v14M5 12h14" />
                        </svg>
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
