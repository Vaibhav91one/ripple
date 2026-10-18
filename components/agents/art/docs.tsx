import { A, line, Plate } from "./plate";

/** Docs Steward: an open book with code on the page. */
export function DocsArt({ className }: { className?: string }) {
  return (
    <Plate accent="ripple" shadow={{ cx: 80, cy: 98, rx: 42 }} className={className}>
      <path d="M80 42c-11-6-27-7-42-4v50c15-3 31-2 42 4 11-6 27-7 42-4V38c-15-3-31-2-42 4z" fill={A} />
      <path d="M80 38c-10-6-24-7-37-4v48c13-3 27-2 37 4z" fill="var(--surface)" />
      <path d="M80 38c10-6 24-7 37-4v48c-13-3-27-2-37 4z" fill="var(--surface)" />
      <path d="M80 40v44" {...line("var(--hairline)")} />
      <path d="M51 48h20M51 56h22M51 64h16" {...line()} />
      <path d="M95 53l-6 6 6 6M107 53l6 6-6 6" {...line(A)} />
      <path d="M103 51l-4 16" {...line()} />
      <path d="M64 33v15l3.5-3 3.5 3V31.5z" fill={A} opacity="0.7" />
      <circle cx="130" cy="24" r="3" fill={A} opacity="0.45" />
      <circle cx="28" cy="30" r="2" fill="var(--faint)" opacity="0.6" />
    </Plate>
  );
}
