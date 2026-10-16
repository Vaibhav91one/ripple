// Obsidian UI (obsidianui.dev) Analytics Dashboard, MIT, see ../LICENSE. Restyled to Ripple tokens.
import { cx, type Tone } from "./tone";

const initials = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("");

/** Image when `src` is given, otherwise the initials of `name` on a tone-tinted disc. */
export function Avatar({ src, name = "", size = 32, tone = "ripple", className }: { src?: string; name?: string; size?: 22 | 32 | 40; tone?: Tone; className?: string }) {
  if (!src) {
    return (
      <span className={cx("oa oa-avatar", `oa-avatar-${size}`, className)} data-tone={tone} aria-hidden="true">
        {initials(name)}
      </span>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element -- plain img keeps the block framework-agnostic
  return <img src={src} alt="" width={size} height={size} loading="lazy" decoding="async" className={cx("oa oa-avatar", `oa-avatar-${size}`, className)} />;
}
