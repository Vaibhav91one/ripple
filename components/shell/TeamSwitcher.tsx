"use client";

import { usePathname, useRouter } from "next/navigation";
import { parseAsString, useQueryState } from "nuqs";
import { useState } from "react";
import { ChevronDown, Users } from "lucide-react";
import { DashboardButton, DashboardPopover, DashboardPopoverContent, DashboardPopoverTrigger } from "@/components/kit/obsidian/dashboard-shell/dashboard-shell";
import { MagneticSelect } from "@/components/kit/bencho/magnetic-select/MagneticSelect";
import { TEAMS } from "./nav";

const OPTIONS = TEAMS.map((t) => ({ id: t.id, label: t.label, icon: <t.icon className="size-[18px]" aria-hidden /> }));

// Team switcher: Bencho Magnetic Select in a popover. Seven teams fill its closed hexagon.
// On a decision page it sets the ?team= lens; everywhere else it opens that team's workspace.
export function TeamSwitcher() {
  const pathname = usePathname();
  const router = useRouter();
  const [lens, setLens] = useQueryState("team", parseAsString);
  const [open, setOpen] = useState(false);
  const onDecision = pathname.startsWith("/decisions/");
  const fromPath = TEAMS.find((t) => pathname.startsWith(`/teams/${t.id}`))?.id ?? null;
  const current = onDecision ? lens : fromPath;
  const label = TEAMS.find((t) => t.id === current)?.label;

  const choose = (id: string) => {
    if (onDecision) void setLens(id);
    else router.push(`/teams/${id}`);
    setOpen(false);
  };

  return (
    <DashboardPopover open={open} onOpenChange={setOpen}>
      <DashboardPopoverTrigger asChild>
        <DashboardButton size="md">
          <Users aria-hidden />
          {label ?? (onDecision ? "All teams" : "Team")}
          <ChevronDown aria-hidden />
        </DashboardButton>
      </DashboardPopoverTrigger>
      <DashboardPopoverContent align="end" className="flex w-auto flex-col items-center gap-1 p-3">
        <MagneticSelect options={OPTIONS} value={current} onChange={choose} label="Team" />
        <p className="text-xs text-faint">{label ? label : onDecision ? "Pick a team lens" : "Pick a team workspace"}</p>
        {onDecision && lens && (
          <button type="button" onClick={() => { void setLens(null); setOpen(false); }} className="text-xs text-ripple hover:underline">
            Show all teams
          </button>
        )}
      </DashboardPopoverContent>
    </DashboardPopover>
  );
}
