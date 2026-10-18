"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Ellipsis, Menu, PanelLeft, Search, X } from "lucide-react";
import { getApprovals } from "@/lib/api";
import { useHydrated } from "@/lib/use-hydrated";
import { Mark } from "@/components/brand/Mark";
import { SiteCredits } from "@/components/SiteCredits";
import { CommandMenu } from "./CommandMenu";
import { NAV, NAV_FOOTER, activeHref, type NavItem } from "./nav";
import type { ShellUser } from "./identity";

/** v2 shell (margin layout): a calm sidebar on the page colour, content on the right. Below lg the sidebar is a drawer. */
export function AppShell({ user: fallback, lensSlot, authSlot, children }: { user: ShellUser; lensSlot?: React.ReactNode; authSlot?: React.ReactNode; children: React.ReactNode }) {
  const pathname = usePathname();
  // The card shows the same identity as /api/me and /profile (per viewer, never shared); the env fallback renders until it loads.
  const me = useQuery({ queryKey: ["me"], queryFn: async () => (await fetch("/api/me")).json() as Promise<ShellUser> });
  const user = me.data?.name ? me.data : fallback;
  // The drawer remembers the path it opened on, so navigating closes it without an effect.
  const [openAt, setOpenAt] = useState<string | null>(null);
  const open = openAt === pathname;
  const [collapsed, setCollapsed] = useState(false);
  const [searching, setSearching] = useState(false);
  const search = () => {
    setOpenAt(null);
    setSearching(true);
  };
  const opener = useRef<HTMLButtonElement>(null);
  const closer = useRef<HTMLButtonElement>(null);
  // The opener sits in the inert top bar while the drawer is open, so focus it after the re-render clears inert.
  const close = () => {
    setOpenAt(null);
    requestAnimationFrame(() => opener.current?.focus());
  };
  // Drawer as a modal dialog: focus moves in on open, Escape closes and returns focus to the menu button.
  useEffect(() => {
    if (!open) return;
    closer.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpenAt(null);
      requestAnimationFrame(() => opener.current?.focus());
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);
  return (
    <div className="flex min-h-dvh bg-page text-body">
      {/* phone and tablet: top bar + drawer */}
      <div inert={open} className="fixed inset-x-0 top-0 z-30 flex h-14 items-center justify-between border-b border-hairline bg-page/90 px-4 backdrop-blur lg:hidden">
        <Brand />
        <div className="flex items-center gap-2">
        <button type="button" onClick={search} aria-label="Search" aria-keyshortcuts="Meta+K Control+K /" className="grid size-11 place-items-center rounded-control border border-hairline bg-surface text-strong">
          <Search size={18} aria-hidden />
        </button>
        <button ref={opener} type="button" onClick={() => setOpenAt(pathname)} aria-label="Open menu" aria-expanded={open} aria-controls="app-sidebar" className="grid size-11 place-items-center rounded-control border border-hairline bg-surface text-strong">
          <Menu size={18} aria-hidden />
        </button>
        </div>
      </div>
      {/* always mounted so the drawer and its scrim animate out too (transform + opacity, duration.drawer on ease.drawer) */}
      <div aria-hidden onClick={close} className={`fixed inset-0 z-40 bg-strong/20 transition-opacity duration-240 ease-drawer lg:hidden ${open ? "opacity-100" : "pointer-events-none opacity-0"}`} />
      <aside
        id="app-sidebar"
        role={open ? "dialog" : undefined}
        aria-modal={open || undefined}
        className={`flex ${open ? "" : "max-lg:invisible max-lg:-translate-x-full"} transition-[translate,visibility] duration-240 ease-drawer fixed inset-y-0 left-0 z-50 w-[272px] flex-col bg-page px-4 pb-4 pt-5 shadow-overlay lg:sticky lg:top-0 lg:z-auto lg:flex lg:h-dvh lg:shadow-none ${collapsed ? "lg:w-[76px] lg:px-3" : "lg:w-[248px]"}`}
        aria-label="Sidebar"
      >
        <div className="flex items-center justify-between pl-1.5">
          {!collapsed && <Brand />}
          <button type="button" onClick={() => setCollapsed((c) => !c)} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} aria-expanded={!collapsed} aria-controls="app-sidebar" className="hidden size-8 place-items-center rounded-control text-faint hover:bg-raised hover:text-strong lg:grid">
            <PanelLeft size={17} aria-hidden />
          </button>
          <button ref={closer} type="button" onClick={close} aria-label="Close menu" className="grid size-11 place-items-center rounded-control text-faint lg:hidden">
            <X size={17} aria-hidden />
          </button>
        </div>
        <button
          type="button"
          onClick={search}
          aria-label="Search"
          aria-keyshortcuts="Meta+K Control+K /"
          title={collapsed ? "Search (⌘K)" : undefined}
          className={`mt-4 flex h-10 items-center gap-3 rounded-control border border-hairline bg-surface px-3 text-sm text-faint shadow-[0_1px_2px_oklch(0_0_0/0.04)] transition-colors hover:text-strong ${collapsed ? "justify-center px-0" : ""}`}
        >
          <Search size={16} strokeWidth={1.7} aria-hidden className="shrink-0" />
          {!collapsed && <span className="flex-1 text-left">Search</span>}
          {!collapsed && <kbd className="rounded-chip border border-hairline px-1.5 font-mono text-2xs">⌘K</kbd>}
        </button>
        <nav className="mt-4 flex flex-col" aria-label="Main">
          {NAV.map((section, i) => (
            <div key={section.title ?? i} className={i ? "mt-6" : ""}>
              {section.title && !collapsed && <p className="mb-1.5 px-3 text-xs text-faint">{section.title}</p>}
              <ul className="flex flex-col gap-0.5">
                {section.items.map((item) => <NavLink key={item.href} item={item} pathname={pathname} collapsed={collapsed} />)}
              </ul>
            </div>
          ))}
        </nav>
        <div className="mt-auto flex flex-col gap-3 pt-6">
          {!collapsed && lensSlot && <div className="flex flex-wrap items-center gap-2 px-1">{lensSlot}</div>}
          <nav aria-label="Account and help"><ul className="flex flex-col gap-0.5">
            {NAV_FOOTER.map((item) => <NavLink key={item.href} item={item} pathname={pathname} collapsed={collapsed} badge={item.label === "Notifications" ? <NotificationCount /> : undefined} />)}
          </ul></nav>
          <div className="border-t border-hairline pt-3">
            <Link href="/profile" className="flex items-center gap-3 rounded-control px-1.5 py-1.5 hover:bg-raised" aria-label="Profile">
              <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-full bg-[conic-gradient(var(--ripple),var(--gap),var(--ripple))] p-[2px]">
                <span className="grid size-full place-items-center rounded-full bg-surface text-xs font-medium text-strong">{user.initials}</span>
              </span>
              {!collapsed && (
                <>
                  <span className="min-w-0 flex-1 leading-tight">
                    <span className="block truncate text-sm font-medium text-strong" title={user.name}>{user.name}</span>
                    <span className="block truncate text-xs text-faint" title={`${user.role} · ${user.org}`}>{user.role} · {user.org}</span>
                  </span>
                  <Ellipsis size={16} className="text-faint" aria-hidden />
                </>
              )}
            </Link>
            {!collapsed && authSlot && <div className="mt-2 flex items-center gap-2 px-1.5">{authSlot}</div>}
            {!collapsed && <SiteCredits className="mt-2 px-1.5 text-left text-2xs leading-snug" />}
          </div>
        </div>
      </aside>
      <CommandMenu open={searching} onOpenChange={setSearching} />
      <main inert={open} className="min-w-0 flex-1 px-4 pb-12 pt-20 sm:px-6 lg:px-8 lg:pt-7">{children}</main>
    </div>
  );
}

function Brand() {
  return (
    <Link href="/" className="flex items-center gap-2.5" aria-label="Ripple home">
      <span className="grid size-8 place-items-center rounded-control bg-surface shadow-hairline">
        <Mark size={20} />
      </span>
      <span className="text-lg font-medium tracking-tight text-strong">ripple</span>
    </Link>
  );
}

function NavLink({ item, pathname, collapsed, badge }: { item: NavItem; pathname: string; collapsed: boolean; badge?: React.ReactNode }) {
  const active = activeHref(pathname) === item.href;
  const Icon = item.icon;
  return (
    <li>
      <Link
        href={item.href}
        aria-current={active ? "page" : undefined}
        title={collapsed ? item.label : undefined}
        aria-label={collapsed ? item.label : undefined}
        className={`flex h-11 items-center gap-3 rounded-control px-3 text-md lg:h-10 transition-colors ${active ? "bg-strong text-ink-on-strong shadow-card" : "text-body hover:bg-raised hover:text-strong"} ${collapsed ? "justify-center px-0" : ""}`}
      >
        <Icon size={17} strokeWidth={1.6} aria-hidden className="shrink-0" />
        {!collapsed && <span className="flex-1 truncate">{item.label}</span>}
        {!collapsed && badge}
      </Link>
    </li>
  );
}

/** Open approvals this viewer may decide (shares the approvals query). Sample data shows no badge. */
function NotificationCount() {
  const { data } = useQuery({ queryKey: ["approvals", "open"], queryFn: () => getApprovals("open"), refetchInterval: 60_000, retry: false });
  // Prerendered markup has no count; render it only after hydration so a warm query cache can't change the first client render.
  const hydrated = useHydrated();
  if (!hydrated || !data?.open || data.sample) return null;
  return <span className="grid h-5 min-w-5 place-items-center rounded-full bg-gap px-1.5 text-2xs font-medium text-strong">{data.open}</span>;
}
