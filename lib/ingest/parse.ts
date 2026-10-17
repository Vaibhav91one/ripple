// Uploaded file -> text. PDF keeps page numbers ("[Page 2]" markers, so quotes can cite them); DOCX has no pages, so paragraphs are the locator.
// Pure (no db): the route and the tests share it. The original file is not kept, only the text and its sha256.
export const MAX_BYTES = 20 * 1024 * 1024;
export const EXTENSIONS = ["md", "markdown", "txt", "pdf", "docx"] as const;
const PARSE_TIMEOUT_MS = 30_000; // ponytail: parsing runs on the event loop; a hard kill needs a worker thread

export type Parsed = { text: string; pages?: string[]; paragraphs?: string[] };

export class UploadError extends Error {}

export const extOf = (name: string) => name.split(".").pop()?.toLowerCase() ?? "";

const timeout = <T>(p: Promise<T>) =>
  Promise.race([p, new Promise<never>((_, rej) => setTimeout(() => rej(new UploadError("Parsing took too long; try a smaller file.")), PARSE_TIMEOUT_MS).unref())]);

export async function parseFile(name: string, buf: Buffer): Promise<Parsed> {
  const ext = extOf(name);
  if (!(EXTENSIONS as readonly string[]).includes(ext)) throw new UploadError(`"${name}" is not supported. Upload a PDF, DOCX, Markdown or text file.`);
  if (buf.length > MAX_BYTES) throw new UploadError(`"${name}" is over the 20MB limit.`);
  let out: Parsed;
  if (ext === "pdf") {
    if (buf.subarray(0, 5).toString() !== "%PDF-") throw new UploadError(`"${name}" is not a PDF file.`);
    const { getDocumentProxy, extractText } = await import("unpdf");
    const { text } = await timeout(getDocumentProxy(new Uint8Array(buf)).then((pdf) => extractText(pdf)));
    const pages = text.map((t) => t.trim());
    out = { pages, text: pages.map((t, i) => `[Page ${i + 1}]\n${t}`).join("\n\n") };
  } else if (ext === "docx") {
    if (buf.subarray(0, 2).toString() !== "PK") throw new UploadError(`"${name}" is not a DOCX file.`);
    const mammoth = (await import("mammoth")).default;
    const { value } = await timeout(mammoth.extractRawText({ buffer: buf }));
    const paragraphs = value.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
    out = { paragraphs, text: paragraphs.join("\n\n") };
  } else {
    out = { text: buf.toString("utf8").replace(/\r\n?/g, "\n").trim() };
  }
  if (!out.text.replace(/\[Page \d+\]/g, "").trim()) throw new UploadError(`No text found in "${name}" (a scanned PDF needs OCR, which is not supported).`);
  return out;
}
