"use client";

// ⌘K command menu (shadcn Command pattern on Radix Dialog): one input over the whole company brain. Graph and agent hits
// come from /api/search (redacted per viewer); pages, actions and saved chats are matched here, instantly.
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { m, useReducedMotion } from "motion/react";
import { Dialog } from "radix-ui";
import {
  ArrowRight, Bot, Building2, Clock, FileSignature, FileText, GitCommitHorizontal, Handshake, LayoutGrid, Loader2, Lock, type LucideIcon,
  MessageCircle, Search, Server, Sparkles, Ticket, User, Users, Zap,
} from "lucide-react";
import { THREADS_KEY, type Thread } from "@/components/assistant/thread";
import { duration, ease, sec } from "@/lib/motion";
import {
  ACTIONS, GROUP_LABEL, MAX_Q, PAGES, askHref, groupHits, highlight, rank, staticScore, type Group, type SearchResult,
} from "@/lib/search";

type Item = { id: string; group: Group | "ask" | "recent"; title: string; sub?: string; href: string; restricted?: boolean; icon?: Group };
const ICON: Record<Group, LucideIcon> = {
  change: GitCommitHorizontal, system: Server, customer: Building2, contract: FileSignature, deal: Handshake, ticket: Ticket,
  document: FileText, team: Users, person: User, agent: Bot, chat: MessageCircle, page: LayoutGrid, action: Zap,
};
const RECENT_KEY = "ripple.v2.cmdk.recent";
const DEBOUNCE = 150;

const readJson = <T,>(key: string, fallback: T): T => {
  try {
    return (JSON.parse(localStorage.getItem(key) ?? "null") as T) ?? fallback;
  } catch {
    return fallback;
  }
};
/** Saved chats across every lens (the Assistant keeps one list per lens key). */
function savedChats(): Thread[] {
  try {
    return Object.keys(localStorage).filter((k) => k.startsWith(THREADS_KEY)).flatMap((k) => readJson<Thread[]>(k, []));
  } catch {
    return [];
  }
}

async function fetchSearch(q: string, signal: AbortSignal): Promise<SearchResult> {
  const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, { signal });
  if (!res.ok) throw new Error(`search ${res.status}`);
  return res.json();
}

function useDebounced<T>(v: T, ms: number) {
  const [d, setD] = useState(v);
  useEffect(() => {
    const t = setTimeout(() => setD(v), ms);
    return () => clearTimeout(t);
  }, [v, ms]);
  return d;
}

export function CommandMenu({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  // ⌘K / Ctrl+K anywhere; "/" when not typing.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const typing = !!t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        onOpenChange(!open);
      } else if (e.key === "/" && !typing && !open && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        onOpenChange(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  const reduce = useReducedMotion();
  const t = { duration: reduce ? 0 : sec(duration.fast), ease: ease.enter };
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay asChild>
          <m.div className="fixed inset-0 z-[60] bg-strong/20" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={t} />
        </Dialog.Overlay>
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed inset-x-3 top-[12dvh] z-[61] mx-auto max-w-[640px] outline-none sm:inset-x-6"
        >
          <m.div
            initial={reduce ? false : { opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={t}
            className="overflow-hidden rounded-card border border-hairline bg-surface shadow-[0_24px_64px_-16px_oklch(0_0_0/0.25)]"
          >
            <Dialog.Title className="sr-only">Search Ripple</Dialog.Title>
            <Menu onDone={() => onOpenChange(false)} />
          </m.div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/** The input and the list. Mounted only while open, so each open starts fresh. */
function Menu({ onDone }: { onDone: () => void }) {
  const router = useRouter();
  const listId = useId();
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const query = q.trim().slice(0, MAX_Q);
  const dq = useDebounced(query, DEBOUNCE);
  const [recent] = useState<Item[]>(() => readJson<Item[]>(RECENT_KEY, []).slice(0, 6));
  const [chats] = useState(savedChats);

  const remote = useQuery({
    queryKey: ["search", dq],
    queryFn: ({ signal }) => fetchSearch(dq, signal),
    enabled: dq.length > 0,
    placeholderData: keepPreviousData,
    staleTime: 30_000,
    retry: false,
  });
  const loading = query.length > 0 && (dq !== query || remote.isFetching);

  const groups = useMemo(() => {
    if (!query) {
      const rec = recent.map((r) => ({ ...r, icon: (r.group === "recent" || r.group === "ask" ? undefined : r.group) ?? r.icon, group: "recent" as const }));
      const pages = PAGES.slice(0, 6).map((p) => ({ id: p.id, group: "page" as const, title: p.title, href: p.href }));
      return [
        ...(rec.length ? [{ group: "recent", label: "Recent", items: rec as Item[] }] : []),
        { group: "page", label: GROUP_LABEL.page, items: pages as Item[] },
      ];
    }
    const local = rank(
      [
        ...chats.map((c) => ({ id: c.id, group: "chat" as const, title: c.title, sub: "Saved chat", href: `/?chat=${encodeURIComponent(c.id)}` })),
        ...PAGES.map((p) => ({ id: p.id, group: "page" as const, title: p.title, sub: p.href, href: p.href, score: staticScore(p, query) ? 1 : 0 })),
        ...ACTIONS.map((a) => ({ id: a.id, group: "action" as const, title: a.title, href: a.href, score: staticScore(a, query) ? 1 : 0 })),
        { id: "open-graph-at", group: "action" as const, title: `Open graph at "${query}"`, href: `/graph?q=${encodeURIComponent(query)}`, score: 1 },
      ],
      query,
    );
    // the previous query's hits stay until the new ones land (keepPreviousData), so the list does not flicker
    const all = groupHits<Item & { group: Group }>([...(remote.data?.hits ?? []), ...local]);
    return [...all, { group: "ask", label: "Ask", items: [{ id: "ask", group: "ask", title: `Ask Ripple: ${query}`, sub: "The Assistant answers with sources", href: askHref(query) }] as Item[] }];
  }, [query, remote.data, recent, chats]);

  const flat = useMemo(() => groups.flatMap((g) => g.items), [groups]);
  const idx = Math.min(active, Math.max(flat.length - 1, 0));
  const count = flat.filter((i) => i.group !== "ask" && i.id !== "open-graph-at").length;

  // keep the active row in view; no animation on keyboard moves
  useEffect(() => {
    listRef.current?.querySelector(`[data-index="${idx}"]`)?.scrollIntoView({ block: "nearest" });
  }, [idx]);

  const choose = (it: Item | undefined) => {
    if (!it) return;
    if (it.group !== "ask") {
      const entry = { id: it.id, group: it.group === "recent" ? (it.icon ?? "page") : it.group, title: it.title, sub: it.sub, href: it.href, restricted: it.restricted };
      try {
        const prev = readJson<Item[]>(RECENT_KEY, []).filter((r) => r.href !== it.href);
        localStorage.setItem(RECENT_KEY, JSON.stringify([entry, ...prev].slice(0, 6)));
      } catch { /* storage unavailable: no recents */ }
    }
    onDone();
    router.push(it.href);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") setActive((idx + 1) % Math.max(flat.length, 1));
    else if (e.key === "ArrowUp") setActive((idx - 1 + flat.length) % Math.max(flat.length, 1));
    else if (e.key === "Home" && e.ctrlKey) setActive(0);
    else if (e.key === "End" && e.ctrlKey) setActive(flat.length - 1);
    else if (e.key === "Enter" && !e.nativeEvent.isComposing) choose(flat[idx]);
    else return;
    e.preventDefault();
  };

  let n = -1;
  return (
    <div onKeyDown={onKeyDown}>
      <div className="flex h-13 items-center gap-3 border-b border-hairline px-4">
        {loading ? <Loader2 size={17} className="shrink-0 animate-spin text-faint" aria-hidden /> : <Search size={17} className="shrink-0 text-faint" aria-hidden />}
        <input
          autoFocus
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setActive(0);
          }}
          placeholder="Search changes, systems, customers, people, agents…"
          role="combobox"
          aria-expanded
          aria-controls={listId}
          aria-activedescendant={flat.length ? `${listId}-${idx}` : undefined}
          aria-autocomplete="list"
          aria-label="Search Ripple"
          maxLength={MAX_Q}
          className="h-full min-w-0 flex-1 bg-transparent text-md text-strong outline-none placeholder:text-faint"
        />
        <kbd className="hidden rounded-chip border border-hairline px-1.5 py-0.5 font-mono text-2xs text-faint sm:block">Esc</kbd>
      </div>
      <p className="sr-only" aria-live="polite">
        {query ? (loading ? "Searching" : `${count} result${count === 1 ? "" : "s"}`) : ""}
      </p>
      <div ref={listRef} id={listId} role="listbox" aria-label="Results" className="max-h-[min(60dvh,460px)] overflow-y-auto overscroll-contain p-2">
        {query && !loading && count === 0 && (
          <p className="px-3 pb-1 pt-3 text-sm text-faint">{remote.isError ? "Search is unavailable right now." : `Nothing in the graph matches "${query}".`} Ask Ripple instead:</p>
        )}
        {groups.map((g) => (
          <div key={g.group} role="group" aria-label={g.label} className="pb-1">
            <p aria-hidden className="px-3 pb-1 pt-2.5 text-xs text-faint">{g.label}</p>
            {g.items.map((it) => {
              n++;
              const i = n;
              const on = i === idx;
              const Icon = it.group === "ask" ? Sparkles : it.restricted ? Lock : it.group === "recent" ? (it.icon ? ICON[it.icon] : Clock) : ICON[it.group];
              return (
                <div
                  key={`${it.group}:${it.id}:${it.href}`}
                  id={`${listId}-${i}`}
                  data-index={i}
                  role="option"
                  aria-selected={on}
                  onMouseMove={() => !on && setActive(i)}
                  onClick={() => choose(it)}
                  className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-control px-3 py-2 ${on ? "bg-raised" : ""}`}
                >
                  <Icon size={16} strokeWidth={1.7} aria-hidden className={`shrink-0 ${it.restricted ? "text-faint" : "text-body"}`} />
                  <span className="min-w-0 flex-1">
                    <span className={`block truncate text-sm ${it.restricted ? "text-faint" : "text-strong"}`}>
                      {it.restricted ? it.title : highlight(it.title, query).map((p, k) => (p.hit ? <mark key={k} className="bg-transparent font-semibold text-strong">{p.text}</mark> : <span key={k}>{p.text}</span>))}
                    </span>
                    {it.sub && <span className="block truncate text-xs text-faint">{it.sub}</span>}
                  </span>
                  {on && <ArrowRight size={14} aria-hidden className="shrink-0 text-faint" />}
                </div>
              );
            })}
          </div>
        ))}
      </div>
      <div className="hidden items-center gap-4 border-t border-hairline px-4 py-2 text-2xs text-faint sm:flex">
        <span><kbd className="font-mono">↑↓</kbd> to move</span>
        <span><kbd className="font-mono">↵</kbd> to open</span>
        <span><kbd className="font-mono">/</kbd> or <kbd className="font-mono">⌘K</kbd> to search</span>
      </div>
    </div>
  );
}
