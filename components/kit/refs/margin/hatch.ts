import type { CSSProperties } from "react";

// Diagonal hatch with a tinted body and a thin outline; `color` is a CSS var such as "var(--hatch)".
export const hatch = (color: string): CSSProperties => ({
  backgroundImage: `repeating-linear-gradient(135deg, ${color} 0 1px, transparent 1px 4px)`,
  backgroundColor: `color-mix(in srgb, ${color} 10%, transparent)`,
  boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${color} 40%, transparent)`,
});
export const card = "rounded-[var(--ref-radius)] border border-hairline bg-surface";
