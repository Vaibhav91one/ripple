import { A, line, Plate } from "./plate";

/** Courier: an envelope with a pin on it. */
export function CourierArt({ className }: { className?: string }) {
  return (
    <Plate accent="ripple" shadow={{ cx: 80, cy: 98, rx: 40 }} className={className}>
      <rect x="40" y="38" width="64" height="44" rx="7" fill="var(--surface)" />
      <path d="M44 44l28 20 28-20" {...line()} />
      <circle cx="108" cy="36" r="11" fill={A} />
      <circle cx="108" cy="36" r="4" fill="var(--surface)" />
      <path d="M108 47v12" {...line()} />
      <circle cx="30" cy="70" r="2" fill="var(--faint)" opacity="0.6" />
    </Plate>
  );
}
