import { A, AS, line, Plate } from "./plate";

/** Impact Analyst: a drop lands, ripples spread across the water. */
export function ImpactArt({ className }: { className?: string }) {
  return (
    <Plate accent="ripple" shadow={{ cx: 80, cy: 92, rx: 50 }} className={className}>
      <ellipse cx="80" cy="74" rx="56" ry="15" fill={AS} />
      <ellipse cx="80" cy="74" rx="42" ry="11" {...line(A)} opacity="0.4" />
      <ellipse cx="80" cy="74" rx="27" ry="7" {...line(A)} opacity="0.7" />
      <ellipse cx="80" cy="74" rx="13" ry="3.5" fill="var(--surface)" />
      <circle cx="80" cy="73" r="3.5" fill={A} />
      <path d="M80 24c6 8 9 12.5 9 17a9 9 0 0 1-18 0c0-4.5 3-9 9-17z" fill="var(--surface)" />
      <path d="M76 42a4 4 0 0 0 3 4" {...line(A)} />
      <circle cx="121" cy="34" r="3" fill={A} opacity="0.5" />
      <circle cx="40" cy="46" r="2" fill="var(--faint)" opacity="0.6" />
      <path d="M118 52h8" {...line()} />
    </Plate>
  );
}
