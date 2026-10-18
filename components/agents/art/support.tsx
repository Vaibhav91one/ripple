import { A, line, Plate } from "./plate";

/** Support Desk: a headset with a reply on the way. */
export function SupportArt({ className }: { className?: string }) {
  return (
    <Plate accent="covered" shadow={{ cx: 76, cy: 100, rx: 34 }} className={className}>
      <path d="M46 66a30 30 0 0 1 60 0h-6a24 24 0 0 0-48 0z" fill="var(--faint)" opacity="0.55" />
      <rect x="42" y="60" width="15" height="24" rx="6" fill={A} />
      <rect x="95" y="60" width="15" height="24" rx="6" fill={A} />
      <rect x="53" y="64" width="5" height="16" rx="2.5" fill="var(--surface)" />
      <rect x="94" y="64" width="5" height="16" rx="2.5" fill="var(--surface)" />
      <path d="M50 84c2 6 8 9 18 9" {...line("var(--strong)")} />
      <rect x="66" y="89.5" width="9" height="7" rx="3.5" fill="var(--strong)" />
      <rect x="98" y="18" width="40" height="24" rx="8" fill="var(--surface)" />
      <path d="M106 41l-4 8 11-8z" fill="var(--surface)" />
      <circle cx="109" cy="30" r="2.2" fill={A} />
      <circle cx="118" cy="30" r="2.2" fill={A} opacity="0.7" />
      <circle cx="127" cy="30" r="2.2" fill={A} opacity="0.4" />
      <circle cx="30" cy="34" r="3" fill={A} opacity="0.4" />
    </Plate>
  );
}
