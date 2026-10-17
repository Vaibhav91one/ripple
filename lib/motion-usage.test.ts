import { readdirSync, readFileSync } from "node:fs";
import { expect, test } from "vitest";

// Timings must come from lib/motion.ts. `duration: 0` (instant, reduced motion) is allowed.
const BAD = /\b(?:duration|delay|repeatDelay|stiffness|damping)\s*:\s*(?!0\s*[,}\s])\.?\d/;
const files = (["components", "app"] as const).flatMap((d) =>
  (readdirSync(d, { recursive: true }) as string[]).filter((f) => /\.tsx?$/.test(f)).map((f) => `${d}/${f}`),
);

test("no hard-coded motion timings in components/ or app/", () => {
  const hits = files.flatMap((f) =>
    readFileSync(f, "utf8").split("\n").flatMap((l, i) => (BAD.test(l) ? [`${f}:${i + 1}`] : [])),
  );
  expect(hits).toEqual([]);
});
