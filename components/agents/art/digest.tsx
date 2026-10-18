import { A, line, Plate } from "./plate";

/** Daily Digest: today's summary on top of a short stack. */
export function DigestArt({ className }: { className?: string }) {
  return (
    <Plate accent="covered" shadow={{ cx: 80, cy: 98, rx: 34 }} className={className}>
      <rect x="56" y="26" width="48" height="62" rx="6" fill="var(--hairline)" transform="rotate(-10 80 57)" />
      <rect x="56" y="26" width="48" height="62" rx="6" fill="var(--raised)" transform="rotate(6 80 57)" />
      <rect x="56" y="24" width="48" height="64" rx="6" fill="var(--surface)" />
      <rect x="64" y="33" width="18" height="6" rx="3" fill={A} />
      <path d="M64 49h32M64 57h26M64 65h32M64 73h18" {...line()} />
      <circle cx="122" cy="32" r="7" fill={A} opacity="0.55" />
      <path d="M122 20v3M122 41v3M110 32h3M131 32h3" {...line(A)} opacity="0.55" />
      <circle cx="36" cy="72" r="3" fill={A} opacity="0.4" />
    </Plate>
  );
}
