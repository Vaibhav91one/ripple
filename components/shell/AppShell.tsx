"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { getApprovals } from "@/lib/api";
import { parseAsString, useQueryState } from "nuqs";
import { Sparkles } from "lucide-react";
import { DashboardButton, DashboardShell } from "@/components/kit/obsidian/dashboard-shell/dashboard-shell";
import { Mark } from "@/components/brand/Mark";
import { HealthPill } from "./HealthPill";
import { NAV, NAV_FOOTER, routeInfo } from "./nav";
import { TeamSwitcher } from "./TeamSwitcher";

/** Dashboard chrome: grouped sidebar, header (title, status slot, Team chip, Ask). Nav lives in ./nav. */
export function AppShell({ status, authSlot, lensSlot, children }: { status?: string; authSlot?: React.ReactNode; lensSlot?: React.ReactNode; children: React.ReactNode }) {
  const pathname = usePathname();
  const { activeId, title } = routeInfo(pathname);
  const [, setAsk] = useQueryState("ask", parseAsString);
  // The Approvals badge: how many open actions this viewer may decide. Shares the /approvals query, so a decision there updates it.
  const { data } = useQuery({ queryKey: ["approvals", "open"], queryFn: () => getApprovals("open"), refetchInterval: 60_000, retry: false });
  const navigation = useMemo(
    () => NAV.map((s) => ({ ...s, items: s.items.map((i) => (i.id === "/approvals" && data?.open && !data.sample ? { ...i, count: data.open } : i)) })),
    [data],
  );
  return (
    <DashboardShell
      className="h-full"
      brand={{ name: "Ripple", logo: <Mark /> }}
      navigation={navigation}
      activeItemId={activeId}
      linkComponent={Link}
      title={title}
      status={status}
      statusTone="neutral"
      secondaryNavigation={NAV_FOOTER}
      sidebarFooter={<HealthPill />}
      headerActions={
        <>
          {lensSlot}
          <TeamSwitcher />
          {authSlot}
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
