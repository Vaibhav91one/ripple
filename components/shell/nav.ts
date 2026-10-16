import { BookOpen, Code2, GitPullRequestArrow, Handshake, Headset, History, Inbox, LayoutDashboard, Network, Scale, ShieldCheck, Target } from "lucide-react";
import type { DashboardShellNavSection } from "@/components/kit/obsidian/dashboard-shell/dashboard-shell";

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
    id: "workspace",
    title: "Workspace",
    items: [
      { id: "/overview", label: "Overview", icon: LayoutDashboard, href: "/overview" },
      { id: "/graph", label: "Graph", icon: Network, href: "/graph" },
      { id: "/decisions", label: "Decisions", icon: GitPullRequestArrow, href: "/decisions" },
      { id: "/changes", label: "Changes", icon: History, href: "/changes" },
      { id: "/inbox", label: "Inbox", icon: Inbox, href: "/inbox" },
    ],
  },
  {
    id: "teams",
    title: "Teams",
    items: TEAMS.map((t) => ({ id: `/teams/${t.id}`, label: t.label, icon: t.icon, href: `/teams/${t.id}` })),
  },
];

/** Page title and active nav id for a pathname. */
export function routeInfo(pathname: string) {
  const hit = NAV.flatMap((s) => s.items).find((i) => pathname === i.id || pathname.startsWith(`${i.id}/`));
  return { activeId: hit?.id, title: hit?.label ?? "Ripple" };
}
