import { readdirSync, readFileSync } from "node:fs";
import { expect, test } from "vitest";

// Type and radius come from the scale in app/globals.css (text-3xs..hero, rounded-sm..card/chip/control/inset).
const BAD = /\btext-\[\d|\brounded(-[a-z]{1,2})?-\[\d/;
// Documented exceptions: glyph-sized micro labels inside 12-16px avatars/badges, and the 24px pill composer (a sheet radius).
const ALLOW = new Set([
  "components/kit/beautifului/streaming-text.tsx:text-[8px]",
  "components/kit/beautifului/streaming-text.tsx:text-[9px]",
  "components/kit/beautifului/context-cards.tsx:text-[7px]",
  "components/kit/beautifului/insight-cards.tsx:text-[8px]",
  "components/kit/beautifului/prompt-bar.tsx:rounded-[24px]",
  "components/kit/beautifului/loading-state.tsx:rounded-[1px]",
  "components/assistant/Assistant.tsx:rounded-t-[24px]",
]);
const files = (["components", "app"] as const).flatMap((d) =>
  (readdirSync(d, { recursive: true }) as string[]).filter((f) => /\.tsx?$/.test(f) && !f.endsWith(".test.ts")).map((f) => `${d}/${f}`),
);

test("no off-scale text-[Npx] or rounded-[Npx] outside the allowlist", () => {
  const hits = files.flatMap((f) =>
    readFileSync(f, "utf8").split("\n").flatMap((l, i) =>
      BAD.test(l) ? [...l.matchAll(/\b(?:text|rounded(?:-[a-z]{1,2})?)-\[\d[^\]]*\]/g)].map((m) => `${f}:${m[0]}`).filter((k) => !ALLOW.has(k)).map((k) => `${k} (line ${i + 1})`) : [],
    ),
  );
  expect(hits).toEqual([]);
});

test("no dark: variants (light only)", () => {
  const hits = files.filter((f) => /(^|[\s"'`])dark:/.test(readFileSync(f, "utf8")));
  expect(hits).toEqual([]);
});
