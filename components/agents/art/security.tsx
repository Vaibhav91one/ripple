import { A, line, Plate } from "./plate";

const SHIELD = "M80 20l29 11v25c0 19-12 31-29 39-17-8-29-20-29-39V31z";

/** Security Reviewer: a shield with a keyhole, checked. */
export function SecurityArt({ className }: { className?: string }) {
  return (
    <Plate accent="covered" shadow={{ cx: 80, cy: 102, rx: 30 }} className={className}>
      <path d={SHIELD} fill="var(--hairline)" transform="translate(0 3)" />
      <path d={SHIELD} fill="var(--surface)" />
      <path d="M80 29l21 8v19c0 14-9 23-21 29-12-6-21-15-21-29V37z" fill={A} />
      <circle cx="80" cy="53" r="6" fill="var(--surface)" />
      <path d="M77 56l-2 13h10l-2-13z" fill="var(--surface)" />
      <circle cx="116" cy="82" r="9" fill="var(--surface)" />
      <path d="M112 82l3 3 5-6" {...line(A)} />
      <circle cx="40" cy="34" r="3" fill={A} opacity="0.4" />
      <circle cx="126" cy="30" r="2" fill="var(--faint)" opacity="0.6" />
    </Plate>
  );
}
