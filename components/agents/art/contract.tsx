import { A, line, Plate } from "./plate";

/** Contract Sentinel: a sealed contract under a magnifier. */
export function ContractArt({ className }: { className?: string }) {
  return (
    <Plate accent="conflict" shadow={{ cx: 82, cy: 98, rx: 38 }} className={className}>
      <rect x="54" y="24" width="46" height="64" rx="6" fill="var(--hairline)" transform="rotate(-7 77 56)" />
      <rect x="56" y="22" width="46" height="66" rx="6" fill="var(--surface)" />
      <path d="M65 34h22M65 42h28M65 50h24M65 58h16" {...line()} />
      <path d="M86 78l-3 10 5-3 4 3 1-10z" fill={A} opacity="0.6" />
      <circle cx="90" cy="76" r="7" fill={A} />
      <circle cx="90" cy="76" r="3" {...line("var(--surface)")} />
      <rect x="117" y="63" width="6" height="18" rx="3" fill="var(--strong)" transform="rotate(-45 120 72)" />
      <circle cx="110" cy="58" r="14" fill="var(--strong)" />
      <circle cx="110" cy="58" r="11" fill="var(--surface)" />
      <path d="M104 55h12M104 61h7" {...line(A)} />
      <circle cx="38" cy="34" r="3" fill={A} opacity="0.45" />
      <circle cx="132" cy="30" r="2" fill="var(--faint)" opacity="0.6" />
    </Plate>
  );
}
