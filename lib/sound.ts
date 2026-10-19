"use client";
import { useSyncExternalStore } from "react";
import type { SoundName } from "cuelume";

// Interaction sounds (Cuelume, Web Audio synthesis). Client-only: every entry guards window, and cuelume loads lazily on first play.
// Default: on at low volume, off when the browser asks for reduced motion. The choice is per browser (localStorage).
// Never plays before a user gesture, in automated browsers (navigator.webdriver) or when AudioContext is missing.
const KEY = "ripple.sound";
const VOLUME = 0.3;
const subs = new Set<() => void>();
let gesture = false;

if (typeof window !== "undefined") {
  const mark = () => { gesture = true; };
  for (const e of ["pointerdown", "keydown"]) window.addEventListener(e, mark, { capture: true, once: true });
}

export function soundOn(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const v = localStorage.getItem(KEY);
    if (v) return v === "on";
  } catch { /* storage blocked: fall through to the default */ }
  return !window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

export function setSoundOn(on: boolean) {
  try { localStorage.setItem(KEY, on ? "on" : "off"); } catch { /* ignore: toggle still works for this page view */ }
  subs.forEach((f) => f());
}

export function useSoundOn() {
  return useSyncExternalStore((f) => { subs.add(f); return () => { subs.delete(f); }; }, soundOn, () => false);
}

export function play(cue: SoundName, emphasis?: "strong") {
  if (typeof window === "undefined" || !gesture || navigator.webdriver || !("AudioContext" in window || "webkitAudioContext" in window) || !soundOn()) return;
  import("cuelume").then((c) => { c.setVolume(VOLUME); c.play(cue, emphasis ? { emphasis } : undefined); }).catch(() => {});
}
