import { A, AS, line, Plate } from "./plate";

/** Decision Advisor: a compass pointing the way out. */
export function AdvisorArt({ className }: { className?: string }) {
  return (
    <Plate accent="gap" shadow={{ cx: 80, cy: 98, rx: 32 }} className={className}>
      <rect x="74" y="20" width="12" height="9" rx="3.5" fill="var(--hairline)" />
      <circle cx="80" cy="60" r="31" fill="var(--hairline)" />
      <circle cx="80" cy="58" r="31" fill="var(--surface)" />
      <circle cx="80" cy="58" r="23" fill={AS} />
      <path d="M80 39v4M80 73v4M61 58h4M95 58h4" {...line()} />
      <g transform="rotate(35 80 58)">
        <path d="M80 41l6 17H74z" fill={A} />
        <path d="M74 58h12l-6 17z" fill="var(--faint)" />
      </g>
      <circle cx="80" cy="58" r="2.5" fill="var(--surface)" />
      <circle cx="124" cy="32" r="3" fill={A} opacity="0.5" />
      <rect x="34" y="78" width="7" height="7" rx="2" fill="var(--faint)" opacity="0.4" transform="rotate(45 37.5 81.5)" />
    </Plate>
  );
}
