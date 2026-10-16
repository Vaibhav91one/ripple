"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { parseAsString, useQueryState } from "nuqs";
import { Sparkles } from "lucide-react";
import { DashboardButton, DashboardShell } from "@/components/kit/obsidian/dashboard-shell/dashboard-shell";
import { HealthPill } from "./HealthPill";
import { NAV, routeInfo } from "./nav";
import { TeamSwitcher } from "./TeamSwitcher";

const Logo = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="var(--ripple)" strokeWidth="1.5" aria-hidden>
    <circle cx="9" cy="9" r="2" fill="var(--ripple)" />
    <circle cx="9" cy="9" r="5.5" opacity=".7" />
    <circle cx="9" cy="9" r="8.25" opacity=".4" />
  </svg>
);

/** Dashboard chrome: grouped sidebar, header (title, status slot, Team chip, Ask). Nav lives in ./nav. */
export function AppShell({ status, children }: { status?: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const { activeId, title } = routeInfo(pathname);
  const [, setAsk] = useQueryState("ask", parseAsString);
  return (
    <DashboardShell
      className="h-full"
      brand={{ name: "Ripple", logo: <Logo /> }}
      navigation={NAV}
      activeItemId={activeId}
      linkComponent={Link}
      title={title}
      status={status}
      statusTone="neutral"
      sidebarFooter={<HealthPill />}
      headerActions={
        <>
          <TeamSwitcher />
          <DashboardButton variant="primary" size="md" onClick={() => setAsk("1")}>
            <Sparkles aria-hidden />
            Ask
          </DashboardButton>
        </>
      }
    >
      {children}
    </DashboardShell>
  );
}
