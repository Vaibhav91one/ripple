import { describe, expect, it } from "vitest";
import { highlightQuote } from "./highlight";

describe("highlightQuote", () => {
  it("quote at start", () => {
    expect(highlightQuote("abc def", "abc")).toEqual([{ text: "abc", hit: true }, { text: " def", hit: false }]);
  });
  it("quote in the middle", () => {
    expect(highlightQuote("abc def ghi", "def")).toEqual([
      { text: "abc ", hit: false }, { text: "def", hit: true }, { text: " ghi", hit: false },
    ]);
  });
  it("quote at end", () => {
    expect(highlightQuote("abc def", "def")).toEqual([{ text: "abc ", hit: false }, { text: "def", hit: true }]);
  });
  it("quote not found: no highlight", () => {
    expect(highlightQuote("abc", "zzz")).toEqual([{ text: "abc", hit: false }]);
  });
});
