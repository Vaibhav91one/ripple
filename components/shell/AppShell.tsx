"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { parseAsString, useQueryState } from "nuqs";
import { Sparkles } from "lucide-react";
import { DashboardButton, DashboardShell } from "@/components/kit/obsidian/dashboard-shell/dashboard-shell";
import { Mark } from "@/components/brand/Mark";
import { HealthPill } from "./HealthPill";
import { NAV, routeInfo } from "./nav";
import { TeamSwitcher } from "./TeamSwitcher";

/** Dashboard chrome: grouped sidebar, header (title, status slot, Team chip, Ask). Nav lives in ./nav. */
export function AppShell({ status, children }: { status?: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const { activeId, title } = routeInfo(pathname);
  const [, setAsk] = useQueryState("ask", parseAsString);
  return (
    <DashboardShell
      className="h-full"
      brand={{ name: "Ripple", logo: <Mark /> }}
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
