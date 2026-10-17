import { BookOpen, Bot, Code2, Handshake, Headset, History, Home, KeyRound, LayoutDashboard, Network, Plug, Scale, Settings, ShieldCheck, Target } from "lucide-react";
import type { DashboardShellNavItem, DashboardShellNavSection } from "@/components/kit/obsidian/dashboard-shell/dashboard-shell";

export const TEAMS = [
  { id: "eng", label: "Engineering", icon: Code2 },
  { id: "support", label: "Support", icon: Headset },
  { id: "sales", label: "Sales", icon: Handshake },
  { id: "legal", label: "Legal", icon: Scale },
  { id: "security", label: "Security", icon: ShieldCheck },
  { id: "devrel", label: "DevRel", icon: BookOpen },
  { id: "leadership", label: "Leadership", icon: Target },
] as const;

export type TeamId = (typeof TEAMS)[number]["id"];
export const isTeamId = (s: string): s is TeamId => TEAMS.some((t) => t.id === s);

// Item ids are route prefixes, so the active item falls out of the pathname.
export const NAV: DashboardShellNavSection[] = [
  {
    id: "work",
    title: "Work",
    items: [
      { id: "/home", label: "Home", icon: Home, href: "/home" },
      { id: "/changes", label: "Changes", icon: History, href: "/changes" },
      { id: "/agents", label: "Agents", icon: Bot, href: "/agents" },
      { id: "/it", label: "IT", icon: KeyRound, href: "/it" },
    ],
  },
  {
    id: "understand",
    title: "Understand",
    items: [
      { id: "/overview", label: "Overview", icon: LayoutDashboard, href: "/overview" },
      { id: "/graph", label: "Graph", icon: Network, href: "/graph" },
      { id: "/connectors", label: "Connectors", icon: Plug, href: "/connectors" },
    ],
  },
];

/** Footer link, rendered below the sections. */
export const NAV_FOOTER: DashboardShellNavItem[] = [{ id: "/settings", label: "Settings", icon: Settings, href: "/settings" }];

/** Routes with a page but no sidebar entry (reached from Home, TeamSwitcher, links): they keep a title, not an active item. */
const UNLISTED = [
  { prefix: "/inbox", title: "Inbox" },
  { prefix: "/decisions", title: "Decisions" },
  ...TEAMS.map((t) => ({ prefix: `/teams/${t.id}`, title: t.label })),
];

const under = (pathname: string, prefix: string) => pathname === prefix || pathname.startsWith(`${prefix}/`);

/** Page title and active nav id for a pathname. */
export function routeInfo(pathname: string) {
  const hit = [...NAV.flatMap((s) => s.items), ...NAV_FOOTER].find((i) => under(pathname, i.id));
  if (hit) return { activeId: hit.id, title: hit.label };
  return { activeId: undefined, title: UNLISTED.find((u) => under(pathname, u.prefix))?.title ?? "Ripple" };
}
