/** Placeholder block (opacity pulse only; reduced motion stops it via globals.css). */
export function Skeleton({ className = "" }: { className?: string }) {
  return <div aria-hidden className={`animate-pulse rounded-inset bg-raised ${className}`} />;
}

/** Page-shaped skeleton: title row, then a card grid. Used by app/(app)/loading.tsx. */
export function PageSkeleton() {
  return (
    <div role="status" aria-label="Loading">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <Skeleton className="h-11 w-48" />
        <div className="flex flex-wrap gap-2"><Skeleton className="h-10 w-36" /><Skeleton className="h-10 w-28" /><Skeleton className="h-10 w-24" /></div>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="rounded-card border border-hairline bg-surface p-6">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="mt-2 h-4 w-24" />
            <Skeleton className="mt-8 h-16 w-40" />
            <Skeleton className="mt-6 h-3 w-full" />
            <Skeleton className="mt-3 h-3 w-4/5" />
          </div>
        ))}
      </div>
    </div>
  );
}
