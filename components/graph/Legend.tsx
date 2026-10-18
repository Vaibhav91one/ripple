// The four node colours, one meaning each (the same tokens RippleGraph paints with).
const ROWS = [
  ["bg-ripple", "Traced path"],
  ["bg-gap", "Not told"],
  ["bg-conflict", "Conflict"],
  ["bg-faint", "Other"],
] as const;

export function Legend({ className = "" }: { className?: string }) {
  return (
    <ul aria-label="Legend" className={`flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md bg-page/80 px-2 py-1 text-xs text-faint ${className}`}>
      {ROWS.map(([dot, label]) => (
        <li key={label} className="flex items-center gap-1.5"><span className={`size-2 rounded-full ${dot}`} aria-hidden />{label}</li>
      ))}
    </ul>
  );
}
