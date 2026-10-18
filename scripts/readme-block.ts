// Shared by graph-map.ts and graph-proof.ts: replace the text between `<!-- name:start -->` and `<!-- name:end -->` in a README.
export function inject(readme: string, name: string, body: string): string {
  const start = `<!-- ${name}:start -->`;
  const end = `<!-- ${name}:end -->`;
  const a = readme.indexOf(start);
  const b = readme.indexOf(end);
  if (a < 0 || b < a) throw new Error(`README is missing the ${start} / ${end} markers`);
  return `${readme.slice(0, a + start.length)}\n${body.trim()}\n${readme.slice(b)}`;
}

export function median(xs: number[]): number {
  const s = [...xs].sort((x, y) => x - y);
  return s[Math.floor(s.length / 2)];
}
