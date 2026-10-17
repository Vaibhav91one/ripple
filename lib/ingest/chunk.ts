// Paragraph-aware chunking. ~1500 tokens is ~6000 chars (4 chars/token); a paragraph bigger than that is cut on sentence ends, then hard.
export const CHUNK_CHARS = 6000;

export function chunkText(text: string, max = CHUNK_CHARS): string[] {
  const pieces: string[] = [];
  for (const p of text.split(/\n\s*\n/).map((s) => s.trim()).filter(Boolean)) {
    if (p.length <= max) { pieces.push(p); continue; }
    let cur = "";
    for (const s of p.split(/(?<=[.!?])\s+/)) {
      for (let i = 0; i < s.length || i === 0; i += max) { // hard-cut a sentence longer than max
        const part = s.slice(i, i + max);
        if (cur && cur.length + part.length + 1 > max) { pieces.push(cur); cur = ""; }
        cur = cur ? `${cur} ${part}` : part;
      }
    }
    if (cur) pieces.push(cur);
  }
  const chunks: string[] = [];
  let cur = "";
  for (const p of pieces) {
    if (cur && cur.length + p.length + 2 > max) { chunks.push(cur); cur = ""; }
    cur = cur ? `${cur}\n\n${p}` : p;
  }
  if (cur) chunks.push(cur);
  return chunks;
}
