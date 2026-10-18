import { A, line, Plate } from "./plate";

const star = (x: number, y: number, s: number) => `M${x} ${y - s}Q${x + s * 0.15} ${y - s * 0.15} ${x + s} ${y}Q${x + s * 0.15} ${y + s * 0.15} ${x} ${y + s}Q${x - s * 0.15} ${y + s * 0.15} ${x - s} ${y}Q${x - s * 0.15} ${y - s * 0.15} ${x} ${y - s}z`;

/** Ask Ripple: a question bubble with a spark of an answer. */
export function AskArt({ className }: { className?: string }) {
  return (
    <Plate accent="ripple" shadow={{ cx: 76, cy: 98, rx: 34 }} className={className}>
      <path d="M58 74l-8 14 22-14z" fill="var(--hairline)" transform="translate(0 3)" />
      <rect x="42" y="31" width="68" height="46" rx="14" fill="var(--hairline)" />
      <rect x="42" y="28" width="68" height="46" rx="14" fill="var(--surface)" />
      <path d="M58 71l-8 14 22-14z" fill="var(--surface)" />
      <path d="M56 44h32M56 52h40M56 60h22" {...line()} />
      <circle cx="88" cy="60" r="3" fill={A} />
      <path d={star(116, 30, 12)} fill={A} />
      <path d={star(130, 54, 5)} fill={A} opacity="0.55" />
      <circle cx="30" cy="40" r="2" fill="var(--faint)" opacity="0.6" />
    </Plate>
  );
}
