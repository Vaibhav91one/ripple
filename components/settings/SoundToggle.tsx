"use client";
import { Volume2, VolumeX } from "lucide-react";
import { play, setSoundOn, useSoundOn } from "@/lib/sound";

/** Speaker button for the sidebar footer. */
export function SoundButton() {
  const on = useSoundOn();
  return (
    <button type="button" role="switch" aria-checked={on} aria-label="Interaction sounds" title={on ? "Sounds on" : "Sounds off"}
      onClick={() => { setSoundOn(!on); if (!on) play("toggle"); }}
      className="grid size-8 place-items-center rounded-control text-faint hover:bg-raised hover:text-strong">
      {on ? <Volume2 size={16} aria-hidden /> : <VolumeX size={16} aria-hidden />}
    </button>
  );
}

/** Profile setting: the same preference as a labelled checkbox. */
export function SoundSetting() {
  const on = useSoundOn();
  return (
    <label className="flex items-start gap-2 text-sm text-body">
      <input type="checkbox" className="mt-1" checked={on} onChange={(e) => setSoundOn(e.target.checked)} />
      <span>Interaction sounds<span className="block text-faint">Soft cues for approvals, saves and errors. Off by default if your device asks for reduced motion. Saved in this browser.</span></span>
    </label>
  );
}
