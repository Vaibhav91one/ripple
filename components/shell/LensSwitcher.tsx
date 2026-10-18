"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Briefcase, ChevronDown, Eye, Handshake, Scale, ShieldCheck, Target } from "lucide-react";
import { DashboardButton, DashboardPopover, DashboardPopoverContent, DashboardPopoverTrigger } from "@/components/kit/obsidian/dashboard-shell/dashboard-shell";
import { MagneticSelect } from "@/components/kit/bencho/magnetic-select/MagneticSelect";
import { LENS_COOKIE, parseLens, type Lens } from "@/lib/lens";

const OPTIONS = [
  { id: "legal", label: "Legal", icon: <Scale className="size-[18px]" aria-hidden /> },
  { id: "sales", label: "Sales", icon: <Handshake className="size-[18px]" aria-hidden /> },
  { id: "security", label: "Security", icon: <ShieldCheck className="size-[18px]" aria-hidden /> },
  { id: "leadership", label: "Leadership", icon: <Target className="size-[18px]" aria-hidden /> },
  { id: "change-owner", label: "Change owner", icon: <Briefcase className="size-[18px]" aria-hidden /> },
];

/** Demo org only: "View as" a team (sets the ripple_lens cookie, then re-reads the page), plus the read-only badge. Mounted by LensArea. */
export function LensSwitcher({ current, local = false }: { current: Lens; local?: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [lens, setLens] = useState(current);
  const label = OPTIONS.find((o) => o.id === lens)?.label;

  const choose = (id: string) => {
    const next = parseLens(id);
    document.cookie = `${LENS_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
    setLens(next);
    setOpen(false);
    router.refresh();
  };

  return (
    <>
      <span className="rounded-chip border border-hairline bg-surface px-2 py-1 text-xs text-faint" title={local ? "Your own writable workspace" : "The shared demo can't be changed"}>
        {local ? "Local workspace" : "Demo · read-only"}
      </span>
      <DashboardPopover open={open} onOpenChange={setOpen}>
        <DashboardPopoverTrigger asChild>
          <DashboardButton size="md" aria-label={`View as ${label}`}>
            <Eye aria-hidden />
            <span>View as {label}</span>
            <ChevronDown aria-hidden />
          </DashboardButton>
        </DashboardPopoverTrigger>
        <DashboardPopoverContent align="end" className="flex w-auto flex-col items-center gap-1 p-3">
          <MagneticSelect options={OPTIONS} value={lens} onChange={choose} label="View as" />
          <p className="text-xs text-faint">{local ? "Local workspace." : "Demo · read-only."} Pick whose view to see.</p>
        </DashboardPopoverContent>
      </DashboardPopover>
      <p className="w-full text-2xs leading-snug text-faint">Viewing as {label}. Switch to see what other teams see.</p>
    </>
  );
}
