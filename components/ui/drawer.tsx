"use client";
import { Dialog } from "radix-ui";
import type { ReactNode } from "react";

/** The one drawer: Radix Dialog (aria-modal, focus trap, Escape, scroll lock) with one motion recipe:
 *  40px slide + fade, 240ms (duration.drawer) on ease.drawer, enter and exit; strong/20 scrim. */
export function Drawer({ open, onOpenChange, title, side = "right", className = "", children }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Accessible name, visually hidden. Omit it when children render a visible <DrawerTitle>. */
  title?: string;
  side?: "left" | "right";
  className?: string;
  children: ReactNode;
}) {
  const slide = side === "right"
    ? "right-0 border-l data-[state=open]:slide-in-from-right-10 data-[state=closed]:slide-out-to-right-10"
    : "left-0 border-r data-[state=open]:slide-in-from-left-10 data-[state=closed]:slide-out-to-left-10";
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="drawer-motion fixed inset-0 z-40 bg-strong/20 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0" />
        <Dialog.Content
          aria-describedby={undefined}
          aria-modal="true"
          className={`drawer-motion fixed inset-y-0 z-50 flex w-full flex-col border-hairline text-body shadow-overlay outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 ${slide} ${className}`}
        >
          {title !== undefined && <Dialog.Title className="sr-only">{title}</Dialog.Title>}
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export const DrawerClose = Dialog.Close;
export const DrawerTitle = Dialog.Title;
