import type { RippleResult } from "@/lib/schemas";

/**
 * The "after" ripple when the sunset moves to `newOn` (epoch seconds): the
 * sunset-vs-guarantee conflicts resolve and the ARR at risk drops to zero.
 * ponytail: assumes the new date clears the guarantees (the result carries no
 * contract end dates); a real move should be re-run through getRipple.
 */
export function applySunsetMove(result: RippleResult, newOn: number): RippleResult {
  if (!Number.isFinite(newOn)) return result;
  return {
    ...result,
    conflicts: result.conflicts.map((c) => ({ ...c, status: "resolved" as const })),
    counts: { ...result.counts, conflicts: 0, arrAtRisk: 0 },
  };
}
