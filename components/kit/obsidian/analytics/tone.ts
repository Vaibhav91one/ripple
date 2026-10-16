// Obsidian UI (obsidianui.dev) Analytics Dashboard, MIT, see ../LICENSE. Colour roles map to Ripple tokens in analytics.css.
import "./analytics.css";

/** One meaning each: conflict, gap, covered. ripple is the accent, neutral is quiet. */
export type Tone = "conflict" | "gap" | "covered" | "neutral" | "ripple";

export const cx = (...c: (string | false | undefined)[]) => c.filter(Boolean).join(" ");
