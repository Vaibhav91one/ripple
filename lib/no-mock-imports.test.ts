import { readdirSync, readFileSync } from "node:fs";
import { expect, test } from "vitest";

// Production code must not read the Ledgerly mock data. What is left here is deliberate or tracked:
//  - lib/ingest/*: the demo seed and its extraction/embedding cache are built from the mock corpus
//  - lib/api.ts: the NEXT_PUBLIC_OFFLINE client fallback
//  - app/api/ask: still canned, to be moved onto the graph in later issues
const ALLOWED = [/^lib\/mock\//, /^lib\/ingest\//, /\.test\.tsx?$/, /^app\/styleguide\//, /^components\/kit\//, /^lib\/api\.ts$/,
  /^app\/api\/ask\/route\.ts$/, /^lib\/assistant\/cached\.ts$/];
const files = (["lib", "app", "components"] as const).flatMap((d) =>
  (readdirSync(d, { recursive: true }) as string[]).filter((f) => /\.tsx?$/.test(f)).map((f) => `${d}/${f}`),
);

test("no import of lib/mock outside lib/mock, tests, the styleguide and the allowed list", () => {
  const hits = files.filter(
    (f) => !ALLOWED.some((a) => a.test(f)) && /from\s+["'][^"']*\/mock\//.test(readFileSync(f, "utf8")),
  );
  expect(hits).toEqual([]);
});
