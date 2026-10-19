import { A, line, Plate } from "./plate";

/** Comms Planner: a calendar page with a speech bubble. */
export function CommsArt({ className }: { className?: string }) {
  return (
    <Plate accent="ripple" shadow={{ cx: 80, cy: 98, rx: 40 }} className={className}>
      <rect x="40" y="26" width="56" height="58" rx="7" fill="var(--surface)" />
      <rect x="40" y="26" width="56" height="14" rx="7" fill={A} />
      <path d="M50 52h10M66 52h10M82 52h6M50 62h10M66 62h10M50 72h10" {...line()} />
      <rect x="86" y="50" width="42" height="26" rx="8" fill="var(--raised)" />
      <path d="M96 76l-2 9 10-9" fill="var(--raised)" />
      <path d="M94 59h26M94 67h16" {...line()} />
      <circle cx="30" cy="40" r="2" fill="var(--faint)" opacity="0.6" />
    </Plate>
  );
}
