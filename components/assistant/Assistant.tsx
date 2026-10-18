"use client";

// The Assistant at `/`: greeting, centred prompt bar, starters, Needs you and one insight card; then a Claude-style thread
// (user bubbles, streamed answer with numbered sources, "Cypher used" chips, inline result cards) with the composer docked.
import { useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog } from "radix-ui";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { CircleAlert, CircleCheck, FileWarning, History, Pencil, Plus, Trash2, Users, X } from "lucide-react";
import { Mark } from "@/components/brand/Mark";
import CodeBlock from "@/components/kit/beautifului/code-block";
import PromptBar from "@/components/kit/beautifului/prompt-bar";
import StreamingText, { type SourceRef, type Token } from "@/components/kit/beautifului/streaming-text";
import { ThinkingLive } from "@/components/kit/beautifului/thinking";
import ToolChips, { type ToolRowData } from "@/components/kit/beautifului/tool-chips";
import { parseStream } from "@/components/ask/parseStream";
import { useSourcePanel } from "@/components/panels/SourcePanel";
import { InsightCard } from "@/components/ui/insight-card";
import { NeedsYou, type NeedsYouRow } from "@/components/ui/needs-you";
import { chatStream, getApprovals, getReports, getRipple, getSource, NotFoundError } from "@/lib/api";
import { AGENT_SAMPLES, STARTER_PROMPTS } from "@/lib/assistant/prompts";
import { cardRuns, ResultCard } from "./cards";
import {
  AGENTS, agentName, answerText, applyEvent, COMMANDS, expandCommand, loadThreads, newTurn, saveThreads, threadsKey, titleOf, toMessages, turnsFromMessages, upsertThread,
  type Thread, type ToolRun, type Turn,
} from "./thread";

type Budget = { remaining: number | null; exhausted: boolean; persist: boolean };
type Item = { id: string; title: string; updatedAt: number };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const COL = "mx-auto w-full max-w-[720px]";

const OUTCOME_NOTE: Partial<Record<NonNullable<Turn["outcome"]>, string>> = {
  not_in_graph: "Not in the graph: nothing connects to this, which is not the same as no impact.",
  unknown_entity: "Unknown entity: that name does not resolve, so no traversal ran.",
  memory: "Answered from memory, not from a live traversal.",
};

const toolRow = (t: ToolRun): ToolRowData => ({
  icon: "run",
  label: "Ran",
  chip: t.tool,
  mono: true,
  detailMono: true,
  detail: [],
  body: <CodeBlock code={t.cypher} language="Cypher" title={t.tool} />,
  meta: t.rows === undefined ? "running…" : `${t.rowCount} ${t.rowCount === 1 ? "row" : "rows"}${t.ms === undefined ? "" : ` · ${t.ms}ms`}`,
});

// ── conversations: Postgres (signed-in orgs) or localStorage (demo) ──────────────────────────────
async function listRemote(): Promise<{ persist: boolean; items: Item[] }> {
  const r = await fetch("/api/conversations").then((x) => x.json()).catch(() => ({ persist: false }));
  const rows = (r.conversations ?? []) as { id: string; title: string; updatedAt: string }[];
  return { persist: !!r.persist, items: rows.map((c) => ({ id: c.id, title: c.title, updatedAt: Date.parse(c.updatedAt) })) };
}
const remote = (id: string, init?: RequestInit) => fetch(`/api/conversations/${encodeURIComponent(id)}`, init).then((r) => r.json());

function greeting(d = new Date()) {
  const h = d.getHours();
  return h < 5 ? "Good evening" : h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}
const noop = () => () => {};

// ── home data: Needs you, the greeting sentence, the insight ─────────────────────────────────────
function useHome() {
  const reports = useQuery({ queryKey: ["reports"], queryFn: getReports, retry: false });
  const approvals = useQuery({ queryKey: ["approvals", "open"], queryFn: () => getApprovals("open"), retry: false });
  const top = reports.data?.cases.find((c) => c.needsYou) ?? reports.data?.cases[0];
  const ripple = useQuery({ queryKey: ["ripple", top?.id], queryFn: () => getRipple(top!.id), enabled: top?.kind === "change", retry: false });
  const rows: NeedsYouRow[] = [];
  const open = approvals.data?.sample ? 0 : approvals.data?.approvals.length ?? 0;
  if (top) {
    const href = `/reports/${encodeURIComponent(top.id)}`;
    if (open) rows.push({ id: "approvals", icon: CircleCheck, tone: "gap", title: `${open} agent ${open === 1 ? "action" : "actions"} to approve`, sub: "Waiting for an OK before anything is sent", href });
    if (top.mainGap) rows.push({ id: "gap", icon: Users, tone: "gap", title: `${top.mainGap.name} has not been told`, sub: top.mainGap.reason, href });
    if (top.openConflicts) rows.push({ id: "conflict", icon: CircleAlert, tone: "conflict", title: `${top.openConflicts} contract ${top.openConflicts === 1 ? "conflict" : "conflicts"}`, sub: `${top.title} breaks a signed promise`, href });
    rows.push({ id: "coverage", icon: FileWarning, tone: "ripple", title: `${top.coverage.told} of ${top.coverage.affected} teams told`, sub: top.title, href });
  }
  const sentence = top
    ? `${rows.length} ${rows.length === 1 ? "thing needs" : "things need"} you today. ${top.title} is ${top.coverage.pct}% told.`
    : reports.isError ? "Ask about any change: who it hits, who was not told, and what it breaks." : "";
  return { top, rows, sentence, ripple: ripple.data, loading: reports.isLoading };
}

// ── page ─────────────────────────────────────────────────────────────────────────────────────────
export function Assistant({ lens, readonly }: { lens?: string; readonly: boolean }) {
  const router = useRouter();
  const search = useSearchParams();
  const qc = useQueryClient();
  const presetAgent = AGENTS.some((a) => a.key === search.get("agent")) ? search.get("agent")! : undefined;
  const [agent, setAgent] = useState<string | undefined>(presetAgent);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [busy, setBusy] = useState(false);
  const [budget, setBudget] = useState<Budget>({ remaining: null, exhausted: false, persist: false });
  const [threads, setThreads] = useState<Thread[]>([]);
  const [current, setCurrent] = useState<{ id: string; conversationId?: string } | null>(null);
  const [sheet, setSheet] = useState(false);
  const abort = useRef<AbortController | null>(null);
  const stick = useRef(true);
  const hello = useSyncExternalStore(noop, () => greeting(), () => "Hello");

  const conv = useQuery({ queryKey: ["conversations"], queryFn: listRemote, retry: false });
  const persist = budget.persist || !!conv.data?.persist;
  // localStorage is read after mount so the server HTML and the first client render match.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setThreads(loadThreads(undefined, threadsKey(lens))), [lens]);
  // A stream still running when the page unmounts is dropped.
  useEffect(() => () => abort.current?.abort(), []);
  const items: Item[] = persist ? conv.data?.items ?? [] : threads;

  // Follow the stream unless the reader scrolled up.
  useEffect(() => {
    const onScroll = () => { stick.current = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 120; };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  useEffect(() => {
    if (stick.current && turns.length) window.scrollTo({ top: document.documentElement.scrollHeight });
  }, [turns]);

  const send = useCallback(async (text: string, opts: { agent?: string } = {}, base?: Turn[]) => {
    const cmd = expandCommand(text);
    if ("href" in cmd) return router.push(cmd.href);
    if (!cmd.prompt || busy) return;
    const prior = base ?? turns;
    const turn = newTurn(cmd.prompt, opts.agent);
    const id = current?.id ?? crypto.randomUUID();
    let conversationId = current?.conversationId;
    let next = [...prior, turn];
    // Each send owns its controller: New chat, opening another thread or unmounting aborts it, and an aborted run
    // never touches state again (no late tokens in the new view, no save of a half answer).
    abort.current?.abort();
    const ac = new AbortController();
    abort.current = ac;
    const live = () => !ac.signal.aborted;
    const set = (fn: (t: Turn) => Turn) => {
      next = [...next.slice(0, -1), fn(next[next.length - 1])];
      if (live()) setTurns(next);
    };
    stick.current = true;
    setTurns(next);
    setCurrent({ id, conversationId });
    setBusy(true);
    let cached = false;
    try {
      for await (const e of parseStream(chatStream({ messages: toMessages(prior, cmd.prompt), agent: opts.agent, conversationId }, ac.signal))) {
        if (!live()) break;
        if (e.type === "meta") {
          cached = e.cached;
          conversationId = e.conversationId ?? conversationId;
          setBudget({ remaining: e.remaining, exhausted: e.exhausted, persist: e.persist });
          setCurrent({ id: conversationId ?? id, conversationId });
        }
        // Cached answers arrive at once; pace them so they read like a stream.
        if (cached && e.type === "text_delta") {
          for (const w of e.text.match(/\S+\s*/g) ?? []) {
            if (!live()) break;
            set((t) => applyEvent(t, { type: "text_delta", text: w }));
            await sleep(22);
          }
          continue;
        }
        if (cached && e.type === "tool_call") await sleep(350);
        if (live()) set((t) => applyEvent(t, e));
      }
    } catch (err) {
      if (live()) set((t) => ({ ...t, error: err instanceof Error ? err.message : "Something went wrong" }));
    } finally {
      if (live()) {
        set((t) => ({ ...t, done: true }));
        setBusy(false);
        if (conversationId) void qc.invalidateQueries({ queryKey: ["conversations"] });
        else {
          const thread: Thread = { id, title: titleOf(next[0].question), updatedAt: Date.now(), turns: next };
          setThreads((ts) => {
            const all = upsertThread(ts, { ...thread, title: ts.find((t) => t.id === id)?.title ?? thread.title });
            saveThreads(all, undefined, threadsKey(lens));
            return all;
          });
        }
      }
    }
  }, [busy, turns, current, router, qc, lens]);

  const newChat = () => {
    abort.current?.abort();
    setBusy(false);
    setTurns([]);
    setCurrent(null);
    setSheet(false);
  };
  const open = async (it: Item) => {
    abort.current?.abort();
    setBusy(false);
    setSheet(false);
    if (persist) {
      const r = await remote(it.id).catch(() => null);
      setTurns(turnsFromMessages(r?.conversation?.messages ?? []));
      setCurrent({ id: it.id, conversationId: it.id });
    } else {
      setTurns(threads.find((t) => t.id === it.id)?.turns ?? []);
      setCurrent({ id: it.id });
    }
  };
  const rename = async (it: Item, title: string) => {
    if (persist) {
      await remote(it.id, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ title }) }).catch(() => null);
      void qc.invalidateQueries({ queryKey: ["conversations"] });
    } else
      setThreads((ts) => {
        const all = ts.map((t) => (t.id === it.id ? { ...t, title } : t));
        saveThreads(all, undefined, threadsKey(lens));
        return all;
      });
  };
  const remove = async (it: Item) => {
    if (current?.id === it.id) newChat();
    if (persist) {
      await remote(it.id, { method: "DELETE" }).catch(() => null);
      void qc.invalidateQueries({ queryKey: ["conversations"] });
    } else
      setThreads((ts) => {
        const all = ts.filter((t) => t.id !== it.id);
        saveThreads(all, undefined, threadsKey(lens));
        return all;
      });
  };

  const bar = (hero: boolean) => (
    <PromptBar
      compact
      hero={hero}
      menuBelow={hero}
      autoFocus
      onSend={(text, o) => void send(text, o)}
      disabled={busy}
      agents={AGENTS}
      sources={[]}
      commands={COMMANDS}
      agent={agent}
      onAgentChange={setAgent}
      remaining={budget.remaining}
      exhausted={budget.exhausted}
      placeholder={agent ? `Ask ${agentName(agent)}…` : hero ? "Ask what a change touches. Type @ for an agent, / for a command" : "Reply to Ripple…"}
    />
  );
  const history = <HistoryList items={items} currentId={current?.id} onOpen={open} onNew={newChat} onRename={rename} onDelete={remove} />;
  const historySheet = (
    <Dialog.Root open={sheet} onOpenChange={setSheet}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-strong/20" />
        <Dialog.Content className="fixed inset-x-0 bottom-0 z-50 max-h-[80dvh] overflow-y-auto rounded-t-[24px] bg-surface p-4 pb-8 shadow-xl">
          <div className="mb-3 flex items-center justify-between">
            <Dialog.Title className="text-md font-medium text-strong">Chats</Dialog.Title>
            <Dialog.Close aria-label="Close" className="grid size-11 place-items-center rounded-control text-faint hover:bg-raised"><X size={17} aria-hidden /></Dialog.Close>
          </div>
          <Dialog.Description className="sr-only">Your recent conversations with Ripple</Dialog.Description>
          {history}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );

  if (!turns.length)
    return (
      <>
        <Home hello={hello} bar={bar(true)} agent={agent} onAsk={(q, a) => void send(q, { agent: a })} recent={items.slice(0, 4)} onOpen={open} onAll={() => setSheet(true)} />
        {historySheet}
      </>
    );

  const last = turns[turns.length - 1];
  return (
    <div className="-mb-12 flex gap-6">
      <aside className="sticky top-7 hidden h-[calc(100dvh-3.5rem)] w-[232px] shrink-0 overflow-y-auto xl:block" aria-label="Chats">{history}</aside>
      <div className="flex min-h-[calc(100dvh-7rem)] min-w-0 flex-1 flex-col lg:min-h-[calc(100dvh-1.75rem)]">
        <div className={`${COL} mb-4 flex items-center justify-between xl:hidden`}>
          <button type="button" onClick={() => setSheet(true)} className="inline-flex h-10 items-center gap-2 rounded-control px-2 text-sm text-body hover:bg-raised"><History size={16} aria-hidden />Chats</button>
          <button type="button" onClick={newChat} className="inline-flex h-10 items-center gap-2 rounded-control px-2 text-sm text-body hover:bg-raised"><Plus size={16} aria-hidden />New chat</button>
        </div>
        <p role="status" className="sr-only">{busy ? (last.tools.some((x) => x.rows === undefined) || !last.tokens.length ? "Querying the graph…" : "Writing the answer…") : last.done && !last.error ? "Answer ready" : ""}</p>
        <ol className={`${COL} flex-1 space-y-10 pb-8`}>
          {turns.map((t, i) => (
            <TurnView
              key={t.id}
              turn={t}
              streaming={busy && i === turns.length - 1}
              readonly={readonly}
              onRetry={i === turns.length - 1 && !busy && !persist ? () => void send(t.question, { agent: t.agent }, turns.slice(0, -1)) : undefined}
            />
          ))}
        </ol>
        <div className="sticky bottom-0 z-10 bg-[linear-gradient(to_top,var(--page)_70%,transparent)] pb-4 pt-6">
          <div className={COL}>{bar(false)}</div>
          {last.exhausted && <span className="sr-only">Showing the cached tour</span>}
        </div>
      </div>
      {historySheet}
    </div>
  );
}

// ── empty state ──────────────────────────────────────────────────────────────────────────────────
function Home({ hello, bar, agent, onAsk, recent, onOpen, onAll }: {
  hello: string; bar: React.ReactNode; agent?: string; onAsk: (q: string, agent?: string) => void;
  recent: Item[]; onOpen: (it: Item) => void; onAll: () => void;
}) {
  const { top, rows, sentence, ripple, loading } = useHome();
  const sample = agent ? AGENT_SAMPLES[agent] : undefined;
  const chips = [...new Set([...(sample ? [sample] : []), ...STARTER_PROMPTS])].slice(0, 5);
  const contracts = ripple?.counts.contracts ?? 0;
  return (
    <div className="mx-auto max-w-[1040px]">
      <section className="mx-auto flex max-w-[720px] flex-col items-center pt-[6vh] text-center lg:pt-[9vh]">
        <span className="grid size-12 place-items-center rounded-[16px] bg-surface shadow-[0_0_0_1px_var(--hairline),0_8px_24px_-12px_oklch(0_0_0/0.18)]"><Mark size={28} /></span>
        <h1 className="mt-6 text-3xl font-light tracking-[-0.035em] text-strong sm:text-[2.75rem] sm:leading-tight">{hello}.</h1>
        <p className={`mt-2 min-h-7 max-w-[34rem] text-balance text-md text-body sm:text-lg ${loading ? "opacity-0" : "opacity-100"} transition-opacity`}>{sentence}</p>
        <div className="relative z-20 mt-8 w-full text-left">{bar}</div>
        <ul className="mt-4 flex flex-wrap justify-center gap-2" aria-label="Starter prompts">
          {chips.map((q) => (
            <li key={q}>
              <button
                type="button"
                onClick={() => onAsk(q, q === sample ? agent : undefined)}
                className="rounded-full border border-hairline bg-surface px-3.5 py-2 text-sm text-body transition-colors hover:border-strong/20 hover:text-strong"
              >
                {q}
              </button>
            </li>
          ))}
        </ul>
        {recent.length > 0 && (
          <div className="mt-8 w-full max-w-[520px] text-left">
            <div className="mb-1 flex items-center justify-between px-2 text-xs text-faint">
              <span>Recent</span>
              <button type="button" onClick={onAll} className="hover:text-body">All chats</button>
            </div>
            <ul>
              {recent.map((it) => (
                <li key={it.id}>
                  <button type="button" onClick={() => onOpen(it)} className="flex w-full items-center gap-2 rounded-control px-2 py-2 text-left text-sm text-body hover:bg-raised">
                    <History size={14} className="shrink-0 text-faint" aria-hidden />
                    <span className="truncate">{it.title}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
      {top && (
        <div className="mt-12 grid grid-cols-[minmax(0,1fr)] gap-5 pb-4 md:grid-cols-2 lg:mt-16">
          <InsightCard
            tag="Pattern found"
            figure={top.arrAtRisk ? `$${Math.round(top.arrAtRisk / 1000)}K` : `${top.coverage.pct}%`}
            figureNote={top.arrAtRisk ? "of ARR rides on this change" : "of affected teams told"}
            headline={contracts && top.openConflicts ? `${contracts} signed contracts still promise what “${top.title}” takes away` : `${top.title}: ${top.coverage.affected - top.coverage.told} teams still to tell`}
            body={top.mainGap?.reason}
            action={{ label: "Review the case", href: `/reports/${encodeURIComponent(top.id)}` }}
          />
          <NeedsYou rows={rows} />
        </div>
      )}
    </div>
  );
}

// ── one exchange ─────────────────────────────────────────────────────────────────────────────────
function TurnView({ turn: t, streaming, readonly, onRetry }: { turn: Turn; streaming: boolean; readonly: boolean; onRetry?: () => void }) {
  const panel = useSourcePanel();
  const titles = useQueries({ queries: t.sources.map((s) => ({ queryKey: ["source", s.artifactId], queryFn: () => getSource(s.artifactId), staleTime: Infinity, retry: false })) });
  const refs: SourceRef[] = t.sources.map((s, i) => {
    const err = titles[i]?.error;
    const title = titles[i]?.data?.title ?? (err ? (err instanceof NotFoundError ? "Source not found" : "Restricted source") : s.artifactId);
    return { n: s.n, name: title, domain: s.artifactId, title, onClick: () => void panel.open(s.artifactId, s.quote) };
  });
  const tokens: Token[] = t.tokens.map((k) => (k.cite ? { text: "", cite: refs[k.cite - 1] } : { text: k.text }));
  const [copied, setCopied] = useState(false);
  const copy = () => {
    const text = [answerText(t), ...refs.map((r) => `[${r.n}] ${r.name}`)].join("\n");
    void navigator.clipboard?.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }, () => {});
  };
  const running = streaming && !t.done;
  const runs = cardRuns(t.tools);
  return (
    <li className="space-y-4">
      <div className="flex justify-end">
        <p className="max-w-[85%] whitespace-pre-wrap rounded-[20px] rounded-br-[6px] bg-raised px-4 py-2.5 text-md leading-relaxed text-strong" style={{ animation: "fade-up 300ms cubic-bezier(0.23,1,0.32,1) both" }}>
          {t.agent && <span className="mr-1.5 font-medium text-faint">@{agentName(t.agent) ?? t.agent}</span>}
          {t.question}
        </p>
      </div>
      <div className="space-y-3" aria-busy={running}>
        <p className="flex items-center gap-2 text-sm text-faint">
          <Mark size={18} />
          <span className="font-medium text-strong">{agentName(t.agent) ?? "Ripple"}</span>
          {t.cached && t.done && <span>· cached answer</span>}
        </p>
        {t.exhausted && (
          <p className="rounded-[14px] border border-gap/30 bg-gap-soft px-3 py-2 text-sm text-strong">Live answers are paused for today. This is the cached tour of the demo company.</p>
        )}
        {t.tools.length > 0 && <ToolChips live rows={t.tools.map(toolRow)} diffs={[]} summary={`Cypher used · ${t.tools.length} ${t.tools.length === 1 ? "query" : "queries"}`} />}
        {running && t.tokens.length === 0 && <div aria-hidden><ThinkingLive label={t.tools.some((x) => x.rows === undefined) ? "Querying the graph…" : t.tools.length ? "Checking the answer against the graph…" : "Thinking…"} /></div>}
        {tokens.length > 0 && (
          <StreamingText
            tokens={tokens}
            sources={refs}
            followUps={[]}
            streaming={running}
            textClassName="text-[15.5px] leading-[1.7]"
            onCopy={copy}
            onRetry={onRetry}
          />
        )}
        {copied && <p role="status" className="text-xs text-faint">Copied</p>}
        {runs.map((r, i) => <ResultCard key={`${r.tool}-${i}`} run={r} readonly={readonly} />)}
        {t.done && (t.rejected || (t.outcome && OUTCOME_NOTE[t.outcome])) && (
          <p className="text-xs leading-normal text-faint">
            {t.rejected && "Rewritten from the graph rows: the draft named something the graph didn't return. "}
            {t.outcome && OUTCOME_NOTE[t.outcome]}
          </p>
        )}
        {t.error && <p role="alert" className="text-sm text-conflict">{t.error}</p>}
      </div>
    </li>
  );
}

// ── history list (sidebar on desktop, sheet on phones) ───────────────────────────────────────────
function HistoryList({ items, currentId, onOpen, onNew, onRename, onDelete }: {
  items: Item[]; currentId?: string; onOpen: (it: Item) => void; onNew: () => void; onRename: (it: Item, title: string) => void; onDelete: (it: Item) => void;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const cancelled = useRef(false);
  return (
    <nav aria-label="Chat history" className="flex flex-col gap-1">
      <button type="button" onClick={onNew} className="mb-2 flex h-10 items-center gap-2 rounded-control border border-hairline bg-surface px-3 text-sm font-medium text-strong hover:bg-raised">
        <Plus size={16} aria-hidden />New chat
      </button>
      {items.length === 0 && <p className="px-3 py-2 text-sm text-faint">Your chats appear here.</p>}
      {items.length > 0 && <p className="px-3 pb-1 pt-2 text-xs text-faint">Recent</p>}
      <ul className="flex flex-col gap-0.5">
        {items.map((it) => (
          <li key={it.id} className={`group flex items-center rounded-control ${it.id === currentId ? "bg-raised" : "hover:bg-raised/70"}`}>
            {editing === it.id ? (
              <form
                className="flex-1 p-1"
                onSubmit={(e) => {
                  e.preventDefault();
                  const v = new FormData(e.currentTarget).get("title")?.toString().trim();
                  if (v && !cancelled.current) onRename(it, v.slice(0, 80));
                  cancelled.current = false;
                  setEditing(null);
                }}
              >
                <input name="title" defaultValue={it.title} aria-label="Chat title" autoFocus onBlur={(e) => e.currentTarget.form?.requestSubmit()} onKeyDown={(e) => { if (e.key === "Escape") { cancelled.current = true; e.currentTarget.form?.requestSubmit(); } }} className="h-8 w-full rounded-inset border border-hairline bg-surface px-2 text-sm text-strong outline-none focus:border-strong/30" />
              </form>
            ) : (
              <>
                <button type="button" onClick={() => onOpen(it)} aria-current={it.id === currentId || undefined} className="min-w-0 flex-1 truncate px-3 py-2 text-left text-sm text-body">{it.title}</button>
                <span className="flex shrink-0 pr-1 opacity-100 transition-opacity xl:opacity-0 xl:group-hover:opacity-100 xl:group-focus-within:opacity-100">
                  <button type="button" aria-label={`Rename ${it.title}`} onClick={() => setEditing(it.id)} className="grid size-8 place-items-center rounded-inset text-faint hover:text-strong"><Pencil size={13} aria-hidden /></button>
                  <button type="button" aria-label={`Delete ${it.title}`} onClick={() => onDelete(it)} className="grid size-8 place-items-center rounded-inset text-faint hover:text-conflict"><Trash2 size={13} aria-hidden /></button>
                </span>
              </>
            )}
          </li>
        ))}
      </ul>
    </nav>
  );
}
