import { StreamEvent } from "@/lib/schemas";

/** Validates every item against the StreamEvent schema; throws on the first invalid one. */
export async function* parseStream(
  input: Iterable<unknown> | AsyncIterable<unknown>,
): AsyncGenerator<StreamEvent> {
  let i = 0;
  for await (const raw of input) {
    const r = StreamEvent.safeParse(raw);
    if (!r.success) throw new Error(`Invalid stream event #${i}: ${r.error.message}`);
    yield r.data;
    i++;
  }
}
