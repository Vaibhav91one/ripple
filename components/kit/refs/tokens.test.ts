import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vitest";

const dir = __dirname;
const bad = /\btext-\[\d|\brounded(-[a-z]{1,2})?-\[\d/;

test("refs use the type scale and radius tokens, not arbitrary values", () => {
  const hits: string[] = [];
  for (const f of readdirSync(dir, { recursive: true, encoding: "utf8" })) {
    if (!/\.tsx?$/.test(f) || f.endsWith(".test.ts")) continue;
    readFileSync(join(dir, f), "utf8")
      .split("\n")
      .forEach((l, i) => bad.test(l) && hits.push(`${f}:${i + 1}`));
  }
  expect(hits).toEqual([]);
});
