import { expect, test } from "vitest";
import { addText, parseStream } from "./parseStream";

const collect = async (input: Iterable<unknown> | AsyncIterable<unknown>) => {
  const out: unknown[] = [];
  for await (const e of parseStream(input)) out.push(e);
  return out;
};

test("passes valid events from an array", async () => {
  const evs = [{ type: "text_delta", text: "hi" }, { type: "done" }];
  expect(await collect(evs)).toEqual(evs);
});

test("accepts an async iterable", async () => {
  async function* g() {
    yield { type: "done" };
  }
  expect(await collect(g())).toEqual([{ type: "done" }]);
});

test("throws a clear error on an invalid event", async () => {
  await expect(collect([{ type: "done" }, { type: "nope" }])).rejects.toThrow(/Invalid stream event #1/);
});

test("addText joins sub-word deltas and splits on spaces", () => {
  let t = { tokens: [] as { text: string }[] };
  for (const d of ["I", " couldn", "'t", " find", " “", "v", "1", " auth", " flow", "” ", "here", "."]) t = addText(t, d);
  expect(t.tokens.map((x) => x.text).join(" ")).toBe("I couldn't find “v1 auth flow” here.");
});
