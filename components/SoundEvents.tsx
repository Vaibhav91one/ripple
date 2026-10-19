"use client";
import { useEffect } from "react";
import { play } from "@/lib/sound";

/** One delegated listener maps the shared controls to cues: buttons (tap, strong when destructive), checkboxes and switches (toggle), sidebar links (navigate). */
export function SoundEvents() {
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const t = e.target instanceof Element ? e.target : null;
      const el = t?.closest<HTMLElement>("button, input[type=checkbox], a");
      if (!el || el.matches(":disabled")) return;
      if (el.matches("input[type=checkbox], [role=switch]")) play("toggle");
      else if (el.closest("nav[aria-label=Main]")) play("navigate");
      else if (el.dataset.variant === "destructive") play("tap", "strong");
      else if (el.dataset.slot === "button" && el.dataset.variant === "default") play("tap");
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);
  return null;
}
