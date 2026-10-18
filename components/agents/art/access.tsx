import { A, line, Plate } from "./plate";

/** Access Planner: an ID badge and the key that goes with it. */
export function AccessArt({ className }: { className?: string }) {
  return (
    <Plate accent="gap" shadow={{ cx: 84, cy: 98, rx: 38 }} className={className}>
      <rect x="48" y="22" width="46" height="64" rx="7" fill="var(--hairline)" transform="rotate(-6 71 54)" />
      <rect x="48" y="22" width="46" height="64" rx="7" fill="var(--surface)" />
      <rect x="65" y="27" width="12" height="4" rx="2" fill="var(--hairline)" />
      <rect x="56" y="38" width="16" height="18" rx="4" fill="var(--raised)" />
      <circle cx="64" cy="45" r="3.5" fill={A} />
      <path d="M58.5 53.5a5.5 5.5 0 0 1 11 0" fill={A} />
      <path d="M77 43h9M77 50h6" {...line()} />
      <rect x="56" y="66" width="30" height="6" rx="3" fill="var(--raised)" />
      <g transform="rotate(-24 106 72)">
        <circle cx="106" cy="72" r="11" fill={A} />
        <circle cx="106" cy="72" r="4" fill="var(--surface)" />
        <rect x="114" y="69" width="24" height="6" rx="3" fill={A} />
        <rect x="128" y="73" width="4" height="7" rx="1.5" fill={A} />
        <rect x="134" y="73" width="4" height="5" rx="1.5" fill={A} />
      </g>
      <circle cx="122" cy="30" r="3" fill={A} opacity="0.45" />
      <circle cx="32" cy="78" r="2" fill="var(--faint)" opacity="0.6" />
    </Plate>
  );
}
