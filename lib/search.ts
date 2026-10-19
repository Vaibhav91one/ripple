// ⌘K search: the shared shapes, ranking, grouping and hrefs. Pure (no I/O) so the route, the menu and tests share it.
import { z } from "zod";
import { KIND_OWNER, RESTRICTED_TITLE, teamName } from "./permissions/classify";

/** Display order of the groups in the menu. */
export const GROUPS = ["change", "system", "customer", "contract", "deal", "ticket", "document", "team", "person", "agent", "chat", "page", "action"] as const;
export type Group = (typeof GROUPS)[number];
export const GROUP_LABEL: Record<Group, string> = {
  action: "Actions", change: "Changes", system: "Systems", customer: "Customers", contract: "Contracts", deal: "Deals", ticket: "Tickets",
  document: "Documents", team: "Teams", person: "People", agent: "Agents", chat: "Saved chats", page: "Pages",
};
export const PER_GROUP = 5;
export const MAX_HITS = 40;
export const MIN_Q = 1;
export const MAX_Q = 80;

/** Graph label -> group. Ticket artifacts come from full-text, so the Ticket label maps there too (deduped by id). */
export const LABEL_GROUP: Record<string, Group> = {
  Decision: "change", Change: "change", System: "system", Customer: "customer", Contract: "contract", Deal: "deal",
  Ticket: "ticket", Team: "team", Person: "person",
};
const ITEM_KIND: Partial<Record<Group, string>> = { customer: "customer", contract: "contract", deal: "deal", person: "person", system: "system" };
const AGENT_TEAMS = new Set(["legal", "sales", "security", "devrel", "support", "leadership", "it"]);

/**
 * A result as the route builds it, before redaction. `label` is the kind noun; redact() swaps a restricted node's
 * `title`/`text` out (it keeps `label`), and a restricted artifact's title becomes RESTRICTED_TITLE with `restricted` = owner.
 * `kind` is the artifact kind (pr, ticket, doc, message) for /items links.
 */
const RawHit = z.object({
  id: z.string(), group: z.enum(GROUPS), label: z.string(), kind: z.string().optional(),
  title: z.string().optional(), text: z.string().optional(), restricted: z.string().optional(), score: z.number().default(0),
});

/** The href is built here, after redaction, so a hidden name never ends up in a URL. */
export const SearchHit = RawHit.transform(({ restricted, title, text, kind, ...h }) => {
  const hidden = !title || title === RESTRICTED_TITLE || !!restricted;
  const owner = restricted ?? (KIND_OWNER as Record<string, string | undefined>)[h.group];
  const noun = h.label.charAt(0).toUpperCase() + h.label.slice(1);
  return {
    id: h.id, group: h.group, score: h.score,
    title: hidden ? `${noun} (restricted)` : title,
    sub: hidden ? (owner ? `Restricted to ${teamName(owner)}` : "Restricted") : text || h.label,
    restricted: hidden,
    href: hrefFor({ ...h, kind, title: hidden ? undefined : title }),
  };
});
export type SearchHit = z.infer<typeof SearchHit>;
export const SearchResult = z.object({ hits: z.array(SearchHit) });
export type SearchResult = z.infer<typeof SearchResult>;

export function hrefFor(h: { id: string; group: Group; kind?: string; title?: string }): string {
  if (h.group === "change") return `/reports/${encodeURIComponent(h.id)}`;
  if (h.group === "agent") return `/agents#${encodeURIComponent(h.id)}`;
  if (h.group === "team") return AGENT_TEAMS.has(h.id) ? `/agents?team=${h.id}` : `/teams/${encodeURIComponent(h.id)}`;
  if (h.group === "ticket" || h.group === "document") return `/items/${h.kind ?? "doc"}/${encodeURIComponent(h.id)}`;
  // systems and customers centre on the graph; restricted stubs and the rest open the item page
  if ((h.group === "system" || h.group === "customer") && h.title) return `/graph?q=${encodeURIComponent(h.title)}`;
  return `/items/${ITEM_KIND[h.group] ?? h.group}/${encodeURIComponent(h.id)}`;
}

export const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

/** How well `title` matches `q`: exact > prefix > word prefix > substring > every word somewhere > 0. */
export function matchScore(title: string, q: string): number {
  const t = norm(title), s = norm(q);
  if (!s) return 0;
  if (t === s) return 100;
  if (t.startsWith(s)) return 80;
  if (t.split(/[\s\-_/:.,()]+/).some((w) => w.startsWith(s))) return 60;
  if (t.includes(s)) return 40;
  const words = s.split(" ");
  return words.length > 1 && words.every((w) => t.includes(w)) ? 30 : 0;
}

/** Full-text query for FalkorDB (RediSearch syntax): words of 2+ characters as prefixes, punctuation dropped. Null = skip. */
export function fulltextQuery(q: string): string | null {
  const words = (q.match(/[\p{L}\p{N}]+/gu) ?? []).filter((w) => w.length >= 2);
  return words.length ? words.map((w) => `${w}*`).join(" ") : null;
}

type Rankable = { id: string; group: Group; title: string; score?: number; /** tie-break: open before closed, then newer first */ live?: boolean; at?: number };
/** Rank by match quality (then the source's own score), dedupe by group+id, cap each group and the total. Keeps group order. */
export function rank<T extends Rankable>(hits: T[], q: string, perGroup = PER_GROUP, max = MAX_HITS): T[] {
  const seen = new Set<string>();
  const scored = hits
    .map((h) => ({ h, s: Math.max(matchScore(h.title, q), h.score ? 20 : 0) + Math.min(h.score ?? 0, 10) / 10 }))
    .filter(({ h, s }) => s > 0 && !seen.has(`${h.group}:${h.id}`) && !!seen.add(`${h.group}:${h.id}`))
    .sort((a, b) => b.s - a.s || Number(b.h.live ?? false) - Number(a.h.live ?? false) || (b.h.at ?? 0) - (a.h.at ?? 0) || GROUPS.indexOf(a.h.group) - GROUPS.indexOf(b.h.group) || a.h.title.localeCompare(b.h.title));
  const per = new Map<Group, number>();
  const kept = scored.filter(({ h }) => {
    const n = per.get(h.group) ?? 0;
    per.set(h.group, n + 1);
    return n < perGroup;
  });
  return kept.slice(0, max).map(({ h }) => h);
}

/** Hits grouped in GROUPS order, each group in rank order. */
export function groupHits<T extends { group: Group }>(hits: T[]): { group: Group; label: string; items: T[] }[] {
  return GROUPS.flatMap((g) => {
    const items = hits.filter((h) => h.group === g);
    return items.length ? [{ group: g, label: GROUP_LABEL[g], items }] : [];
  });
}

/** Split `text` around the first case-insensitive match of `q`, for <mark>. */
export function highlight(text: string, q: string): { text: string; hit: boolean }[] {
  const s = q.trim();
  const i = s ? text.toLowerCase().indexOf(s.toLowerCase()) : -1;
  if (i < 0) return [{ text, hit: false }];
  return [{ text: text.slice(0, i), hit: false }, { text: text.slice(i, i + s.length), hit: true }, { text: text.slice(i + s.length), hit: false }].filter((p) => p.text);
}

/** Pages in the app, matched client-side. */
export const PAGES: { id: string; title: string; href: string; keywords?: string }[] = [
  { id: "assistant", title: "Assistant", href: "/", keywords: "ask chat home" },
  { id: "reports", title: "Reports", href: "/reports", keywords: "changes case files" },
  { id: "analytics", title: "Analytics", href: "/analytics", keywords: "metrics" },
  { id: "graph", title: "Graph", href: "/graph", keywords: "falkordb nodes map" },
  { id: "agents", title: "Agents", href: "/agents" },
  { id: "connections", title: "Connections", href: "/connections", keywords: "sources" },
  { id: "integrations", title: "Integrations", href: "/integrations" },
  { id: "notifications", title: "Notifications", href: "/reports?view=activity", keywords: "activity inbox" },
  { id: "settings", title: "Settings", href: "/settings", keywords: "preferences keys" },
  { id: "help", title: "Help", href: "/help", keywords: "docs support" },
  { id: "profile", title: "Profile", href: "/profile", keywords: "me account" },
];
/** Fixed actions; "Ask Ripple" is added separately as the always-present fallback. */
export const ACTIONS: { id: string; title: string; href: string; keywords?: string }[] = [
  { id: "connect-github", title: "Connect GitHub", href: "/integrations", keywords: "integration repo" },
  { id: "connect-slack", title: "Connect Slack", href: "/integrations", keywords: "integration chat" },
  { id: "open-graph", title: "Open the graph", href: "/graph" },
  { id: "new-chat", title: "New chat with the Assistant", href: "/", keywords: "ask" },
];
/** Score a static entry on its title, then its keywords (keywords never beat a title match). */
export const staticScore = (e: { title: string; keywords?: string }, q: string) =>
  matchScore(e.title, q) || (e.keywords ? Math.min(matchScore(e.keywords, q), 30) : 0);

export const askHref = (q: string) => `/?q=${encodeURIComponent(q.trim())}`;
