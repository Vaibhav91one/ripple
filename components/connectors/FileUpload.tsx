"use client";

import Link from "next/link";
import { useId, useRef, useState } from "react";
import { EXTENSIONS, MAX_BYTES, extOf } from "@/lib/ingest/parse";

type Result = { name: string; ok: true; chars: number; pages?: number; duplicate: boolean; clauses?: number; linked?: boolean } | { name: string; ok: false; error: string };
const TYPES = [["document", "Document"], ["rfc", "RFC or decision"], ["contract", "Contract"]] as const;
const field = "h-8 rounded-md border border-hairline bg-raised px-2 text-sm text-strong";
const btn = "inline-flex h-8 items-center rounded-md border border-hairline bg-raised px-3 text-sm text-strong disabled:opacity-50";

/** Pick files -> choose a type -> upload (progress bar) -> per-file result. The server parses and queues ingestion; the original file is not kept. */
export function FileUpload({ canUpload, customers }: { canUpload: boolean; customers: { id: string; name: string }[] }) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [type, setType] = useState<(typeof TYPES)[number][0]>("document");
  const [files, setFiles] = useState<File[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [effective, setEffective] = useState("");
  const [expires, setExpires] = useState("");
  const [pct, setPct] = useState<number>();
  const [results, setResults] = useState<Result[]>();
  const [error, setError] = useState<string>();
  const [over, setOver] = useState(false);
  const busy = pct !== undefined;

  const add = (list: FileList | File[]) => {
    const bad = [...list].filter((f) => !(EXTENSIONS as readonly string[]).includes(extOf(f.name)) || f.size > MAX_BYTES);
    const msg = bad.map((f) => (f.size > MAX_BYTES ? `"${f.name}" is over the 20MB limit.` : `"${f.name}" is not supported. Upload a PDF, DOCX, Markdown or text file.`));
    setError(msg.join(" ") || undefined); setResults(undefined);
    setFiles((old) => [...old, ...[...list].filter((f) => !bad.includes(f))]);
  };

  const run = () => {
    const body = new FormData();
    body.set("type", type);
    if (type === "contract") { body.set("customerId", customerId); body.set("effective", effective); body.set("expires", expires); }
    files.forEach((f) => body.append("files", f));
    setError(undefined); setPct(0);
    const x = new XMLHttpRequest();
    x.open("POST", "/api/connectors/upload");
    x.upload.onprogress = (e) => e.lengthComputable && setPct(Math.round((e.loaded / e.total) * 90)); // the last 10% is the server parsing
    x.onload = () => {
      setPct(undefined);
      if (x.status === 403) return setError("Only admins can upload.");
      try {
        const j = JSON.parse(x.responseText);
        if (x.status !== 200) return setError(j.message ?? `Upload failed (${x.status}).`);
        setResults(j.results); setFiles([]);
      } catch { setError(`Upload failed (${x.status}).`); }
    };
    x.onerror = () => { setPct(undefined); setError("Upload failed. Check your connection."); };
    x.send(body);
  };

  const ok = results?.filter((r) => r.ok) ?? [];
  return (
    <div className="max-w-3xl space-y-8" aria-busy={busy}>
      {!canUpload && <p role="status" className="rounded-lg border border-hairline bg-raised px-4 py-3 text-sm text-body">Uploading needs an admin account. You can still pick a file to see how it is checked.</p>}

      <section aria-labelledby={`${id}-1`} className="space-y-3">
        <h2 id={`${id}-1`} className="text-sm font-medium text-strong">1. Choose a type and files</h2>
        <label className="block text-sm text-body">Type{" "}
          <select className={field} value={type} onChange={(e) => setType(e.target.value as typeof type)}>
            {TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>
        {type === "contract" && (
          <div className="flex flex-wrap items-center gap-3">
            <label className="text-sm text-body">Customer (optional){" "}
              <select className={`${field} max-w-56`} value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
                <option value="">Not linked</option>
                {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
            <label className="text-sm text-body">Effective <input type="date" className={field} value={effective} onChange={(e) => setEffective(e.target.value)} /></label>
            <label className="text-sm text-body">Expires <input type="date" className={field} value={expires} onChange={(e) => setExpires(e.target.value)} /></label>
          </div>
        )}
        <div
          onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
          onDrop={(e) => { e.preventDefault(); setOver(false); add(e.dataTransfer.files); }}
          className={`flex flex-col items-center gap-2 rounded-card border border-dashed p-8 text-center ${over ? "border-ripple bg-ripple-soft" : "border-hairline bg-surface"}`}
        >
          <p className="text-sm text-body">Drag files here, or</p>
          <button type="button" className={btn} onClick={() => input.current?.click()}>Choose files</button>
          <input ref={input} type="file" multiple hidden accept=".pdf,.docx,.md,.markdown,.txt" onChange={(e) => e.target.files && add(e.target.files)} />
          <p className="text-xs text-faint">PDF, DOCX, Markdown or text. Up to 20MB each. Only the extracted text and its sha256 are stored, not the original file.</p>
        </div>
        {error && <p role="alert" className="text-sm text-conflict">{error}</p>}
        {files.length > 0 && (
          <ul className="divide-y divide-hairline rounded-card border border-hairline bg-surface text-sm">
            {files.map((f, i) => (
              <li key={`${f.name}-${i}`} className="flex items-center justify-between gap-3 px-3 py-2">
                <span className="min-w-0 truncate text-body">{f.name} <span className="text-faint">{(f.size / 1024).toFixed(0)} KB</span></span>
                <button type="button" className="text-faint underline-offset-4 hover:underline" disabled={busy} onClick={() => setFiles(files.filter((_, j) => j !== i))}>Remove</button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby={`${id}-2`} className="space-y-3">
        <h2 id={`${id}-2`} className="text-sm font-medium text-strong">2. Upload</h2>
        <button type="button" className={btn} disabled={busy || !canUpload || !files.length} onClick={run}>{busy ? "Uploading..." : `Upload ${files.length || ""} ${files.length === 1 ? "file" : "files"}`}</button>
        {busy && (
          <div role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Upload progress" className="h-1.5 w-full max-w-sm overflow-hidden rounded-full bg-raised">
            <div className="h-full bg-ripple transition-[width]" style={{ width: `${pct}%` }} />
          </div>
        )}
        {results && (
          <div role="status" className="space-y-3 text-sm text-body">
            <ul className="divide-y divide-hairline rounded-card border border-hairline bg-surface">
              {results.map((r) => (
                <li key={r.name} className="px-3 py-2">
                  <span className="text-strong">{r.name}</span>{" "}
                  {r.ok
                    ? <span className="text-covered">{r.duplicate ? "Already uploaded, nothing changed" : `Read ${r.pages ? `${r.pages} pages, ` : ""}${r.chars.toLocaleString()} characters`}
                      {r.clauses !== undefined && `; ${r.clauses} clauses found${r.linked === false ? " (customer not found, not linked)" : ""}`}</span>
                    : <span className="text-conflict">{r.error}</span>}
                </li>
              ))}
            </ul>
            {ok.some((r) => !(r as { duplicate: boolean }).duplicate) && (
              <p>{ok.length} {ok.length === 1 ? "file" : "files"} queued for ingestion. Proposed edges appear in <Link href="/reports" className="text-ripple underline-offset-4 hover:underline">Reports</Link> once the worker finishes.</p>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
