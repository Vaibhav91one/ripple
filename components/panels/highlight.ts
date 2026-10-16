export type Segment = { text: string; hit: boolean };

/** Split `text` around the first verbatim occurrence of `quote`. Not found (or empty quote): one plain segment. */
export function highlightQuote(text: string, quote: string): Segment[] {
  const i = quote ? text.indexOf(quote) : -1;
  if (i < 0) return [{ text, hit: false }];
  return [
    { text: text.slice(0, i), hit: false },
    { text: quote, hit: true },
    { text: text.slice(i + quote.length), hit: false },
  ].filter((s) => s.text);
}
