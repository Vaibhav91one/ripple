import { expect, test } from "vitest";
import type { Incident, PrRow } from "@/lib/schemas";
import { cycleWeeks, incidentStats, prQuality } from "./schema";

const NOW = 1_000_000_000;
const pr = (o: Partial<PrRow>): PrRow => ({ id: "p", title: "t", repo: "r", authorId: "a", state: "merged", additions: 10, deletions: 5, createdAt: NOW - 3 * 3600, firstReviewAt: NOW - 2 * 3600, mergedAt: NOW - 3600, reviewerIds: [], v1Related: false, ...o });

test("cycleWeeks splits a merged PR into pickup and review in the newest week", () => {
  const weeks = cycleWeeks([pr({})], NOW);
  expect(weeks.at(-1)).toMatchObject({ pickup: 1, review: 1, deploy: 0.5, merged: 1 });
  expect(weeks.slice(0, -1).every((w) => w.merged === 0)).toBe(true);
});

test("prQuality buckets by changed lines and counts merged without review", () => {
  const q = prQuality([pr({}), pr({ additions: 500, deletions: 0, firstReviewAt: null }), pr({ additions: 2000, state: "open", mergedAt: null })]);
  expect(q.buckets.map((b) => b.count)).toEqual([1, 0, 1, 1]);
  expect(q).toMatchObject({ mergedWithoutReview: 1, merged: 2 });
});

test("incidentStats averages only the timestamps that exist", () => {
  const inc = (o: Partial<Incident>): Incident => ({ id: "i", title: "t", severity: "low", systemId: "s", startedAt: 0, acknowledgedAt: 3600, resolvedAt: 7200, ...o });
  expect(incidentStats([inc({}), inc({ acknowledgedAt: null, resolvedAt: null })])).toEqual({ mttaH: 1, mttrH: 2 });
});
