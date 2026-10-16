import { expect, test } from "vitest";
import { parseStream } from "./parseStream";

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
