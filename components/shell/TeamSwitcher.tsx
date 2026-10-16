"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, Users } from "lucide-react";
import { DashboardButton, DashboardPopover, DashboardPopoverContent, DashboardPopoverTrigger } from "@/components/kit/obsidian/dashboard-shell/dashboard-shell";
import { TEAMS } from "./nav";

// Placeholder: #42 swaps this body for the Magnetic Select team switcher. Keep the export name and no props.
export function TeamSwitcher() {
  const pathname = usePathname();
  const current = TEAMS.find((t) => pathname.startsWith(`/teams/${t.id}`));
  return (
    <DashboardPopover>
      <DashboardPopoverTrigger asChild>
        <DashboardButton size="md">
          <Users aria-hidden />
          {current?.label ?? "Team"}
          <ChevronDown aria-hidden />
        </DashboardButton>
      </DashboardPopoverTrigger>
      <DashboardPopoverContent align="end" className="w-48">
        <ul>
          {TEAMS.map((t) => (
            <li key={t.id}>
              <Link href={`/teams/${t.id}`} className="flex h-8 items-center gap-2 rounded-md px-2 text-sm hover:bg-(--obsidian-dashboard-shell-menu-highlight)">
                <t.icon className="size-4" aria-hidden />
                {t.label}
              </Link>
            </li>
          ))}
        </ul>
      </DashboardPopoverContent>
    </DashboardPopover>
  );
}
