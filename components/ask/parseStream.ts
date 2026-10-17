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

type Words = { tokens: { text: string }[]; glue?: boolean };
/** Append a text delta as word tokens. Models stream sub-word pieces ("couldn" + "'t"), so only spaces split words. */
export function addText<T extends Words>(t: T, text: string): T {
  const [head, ...rest] = text.split(" ");
  const tokens = [...t.tokens];
  if (head && t.glue && tokens.length) tokens[tokens.length - 1] = { ...tokens[tokens.length - 1], text: tokens[tokens.length - 1].text + head };
  else if (head) tokens.push({ text: head });
  for (const w of rest) if (w) tokens.push({ text: w });
  return { ...t, tokens, glue: !/\s$/.test(text) && tokens.length > 0 };
}
