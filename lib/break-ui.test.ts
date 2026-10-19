import { expect, test } from "vitest";
import { fmtUsd, stepText } from "@/components/analytics/model";
import { titleOf } from "@/components/assistant/thread";
import { initials } from "@/lib/me";

// Worst-case data from the break-UI review (#271).
test("money never reads $1000K or a double minus", () => {
  expect([fmtUsd(999_950), fmtUsd(4_200_000_000), fmtUsd(-1_500)]).toEqual(["$1M", "$4.2B", "−$1.5K"]);
  expect(stepText(-4, null)).toBe("−4 pts");
  expect(stepText(4, 62_000)).toBe("−4 pts · $62K");
});

test("initials use the first and last word, whole graphemes", () => {
  expect([initials("Ana María de la Cruz"), initials("Zoë"), initials("🦊 Fox"), initials(""), initials("李 小龙")]).toEqual(["AC", "Z", "🦊F", "?", "李小"]);
});

test("thread titles cut by grapheme, never mid-emoji", () => {
  const q = "👩‍💻".repeat(70);
  const t = titleOf(q);
  expect(t.endsWith("…")).toBe(true);
  expect(Array.from(new Intl.Segmenter().segment(t.slice(0, -1))).every((g) => g.segment === "👩‍💻")).toBe(true);
  expect(titleOf("short")).toBe("short");
});
