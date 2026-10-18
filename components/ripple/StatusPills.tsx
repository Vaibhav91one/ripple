const pill = (n: number, cls: string, label: string) => (
  <span
    title={`${n} ${label}`}
    className={`flex h-4.5 min-w-4.5 items-center justify-center rounded-full px-1 text-2xs font-semibold tabular-nums ${cls}`}
  >
    {n}
  </span>
);

/** Conflict and gap count pills; renders nothing visible when both are zero. */
export function StatusPills({ conflicts, notTold }: { conflicts: number; notTold: number }) {
  return (
    <span className="flex shrink-0 items-center gap-1">
      {conflicts > 0 && pill(conflicts, "bg-conflict-soft text-conflict-ink", "open conflicts")}
      {notTold > 0 && pill(notTold, "bg-gap-soft text-gap-ink", "teams not told")}
    </span>
  );
}
