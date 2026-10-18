import { A, line, Plate } from "./plate";

const Card = ({ x, y, r, on }: { x: number; y: number; r: number; on?: boolean }) => (
  <g transform={`rotate(${r} ${x + 12} ${y + 9})`}>
    <rect x={x} y={y} width="24" height="18" rx="4" fill="var(--surface)" />
    <circle cx={x + 7} cy={y + 9} r="3.5" fill={on ? A : "var(--faint)"} opacity={on ? 1 : 0.5} />
    <path d={`M${x + 13} ${y + 7}h6M${x + 13} ${y + 12}h4`} {...line()} />
  </g>
);

/** Customer Exposure: customer cards dropping into a funnel. */
export function ExposureArt({ className }: { className?: string }) {
  return (
    <Plate accent="gap" shadow={{ cx: 80, cy: 98, rx: 30 }} className={className}>
      <Card x={42} y={22} r={-14} />
      <Card x={68} y={14} r={0} on />
      <Card x={94} y={22} r={14} />
      <path d="M54 52h52l-17 22v16a3 3 0 0 1-3 3h-12a3 3 0 0 1-3-3V74z" fill="var(--surface)" />
      <rect x="51" y="47" width="58" height="9" rx="4.5" fill={A} />
      <path d="M66 64h28M74 74h12" {...line()} />
      <circle cx="80" cy="85" r="2.5" fill={A} />
      <circle cx="128" cy="62" r="2" fill="var(--faint)" opacity="0.6" />
      <circle cx="32" cy="64" r="3" fill={A} opacity="0.4" />
    </Plate>
  );
}
