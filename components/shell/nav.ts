import { BarChart3, Bell, BookOpen, Bot, Cable, Code2, FileText, Handshake, Headset, LifeBuoy, type LucideIcon, MessageCircle, Puzzle, Scale, Settings, ShieldCheck, Target } from "lucide-react";

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

export type NavItem = { href: string; label: string; icon: LucideIcon };

// v2 sidebar (margin layout). Sub-pages keep their parent active: /reports/x lights Reports.
export const NAV: { title?: string; items: NavItem[] }[] = [
  {
    items: [
      { href: "/", label: "Assistant", icon: MessageCircle },
      { href: "/reports", label: "Reports", icon: FileText },
      { href: "/analytics", label: "Analytics", icon: BarChart3 },
    ],
  },
  {
    title: "Workspace",
    items: [
      { href: "/agents", label: "Agents", icon: Bot },
      { href: "/connections", label: "Connections", icon: Cable },
      { href: "/integrations", label: "Integrations", icon: Puzzle },
    ],
  },
];

/** Bottom of the sidebar, above the user card. */
export const NAV_FOOTER: NavItem[] = [
  { href: "/reports?tab=activity", label: "Notifications", icon: Bell },
  { href: "/settings", label: "Settings", icon: Settings },
  { href: "/help", label: "Help", icon: LifeBuoy },
];

const under = (pathname: string, prefix: string) => (prefix === "/" ? pathname === "/" : pathname === prefix || pathname.startsWith(`${prefix}/`));

/** The nav href that is active for a pathname (undefined when nothing matches). */
export function activeHref(pathname: string) {
  return [...NAV.flatMap((s) => s.items), ...NAV_FOOTER].find((i) => under(pathname, i.href.split("#")[0]))?.href;
}
