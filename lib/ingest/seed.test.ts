import { expect, test } from "vitest";
import { seedTarget } from "./seed";

test("pnpm seed <graph> seeds only the named graph; no argument seeds demo", () => {
  expect(seedTarget(["test_seed_253"])).toBe("test_seed_253");
  expect(seedTarget(["--", "test_seed_253"])).toBe("test_seed_253");
  expect(seedTarget([])).toBe("demo");
});
