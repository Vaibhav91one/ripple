"use client";

import { useId, useState } from "react";
import Papa from "papaparse";
import { CSV_TYPES, mapRow, missingRequired, suggestMapping, type CsvType, type Mapping } from "@/lib/connectors/csv/map";

type Row = Record<string, string>;
type Result = { applied: number; errors: { row: number; message: string }[] };
const CHUNK = 500;
const field = "h-8 rounded-md border border-hairline bg-raised px-2 text-sm text-strong";
const btn = "inline-flex h-8 items-center rounded-md border border-hairline bg-raised px-3 text-sm text-strong disabled:opacity-50";

/** Upload -> map columns -> preview 20 rows -> import. Parsing is in the browser; rows go to the server in chunks of 500. */
export function CsvImport({ canImport }: { canImport: boolean }) {
  const id = useId();
  const [type, setType] = useState<CsvType>("customers");
  const [file, setFile] = useState<string>();
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [mapping, setMapping] = useState<Mapping>({});
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result>();
  const [error, setError] = useState<string>();
  const def = CSV_TYPES.find((t) => t.type === type)!;
  const missing = missingRequired(type, mapping);

  const load = (f: File) => {
    const acc: Row[] = [];
    let h: string[] = [];
    setResult(undefined); setError(undefined);
    Papa.parse<Row>(f, {
      header: true, skipEmptyLines: true,
      step: (r) => { acc.push(r.data); h = r.meta.fields ?? h; }, // with step, complete() gets no results
      complete: () => {
        setFile(f.name); setHeaders(h); setRows(acc); setMapping(suggestMapping(type, h));
        if (!acc.length) setError("That file has no data rows.");
      },
      error: (e) => setError(e.message),
    });
  };
  const pickType = (t: CsvType) => { setType(t); setResult(undefined); setMapping(suggestMapping(t, headers)); };

  // Row problems the server would report, shown before importing.
  const problems = rows.slice(0, 20).flatMap((row, i) => {
    try { mapRow({ type, mapping, row, rowNo: i + 2, uploadId: "preview" }); return []; } catch (e) { return [{ row: i + 2, message: (e as Error).message }]; }
  });

  const run = async () => {
    setBusy(true); setError(undefined);
    const uploadId = crypto.randomUUID();
    const total: Result = { applied: 0, errors: [] };
    try {
      for (let offset = 0; offset < rows.length; offset += CHUNK) {
        const res = await fetch("/api/connectors/csv/import", { method: "POST", headers: { "content-type": "application/json" },
          body: JSON.stringify({ type, mapping, uploadId, offset, rows: rows.slice(offset, offset + CHUNK) }) });
        if (!res.ok) throw new Error(res.status === 403 ? "Only admins can import." : `Import failed (${res.status}).`);
        const part: Result = await res.json();
        total.applied += part.applied; total.errors.push(...part.errors);
      }
      setResult(total);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-5xl space-y-8" aria-busy={busy}>
      {!canImport && <p role="status" className="rounded-lg border border-hairline bg-raised px-4 py-3 text-sm text-body">Importing needs an admin account. You can still try a file to see the mapping and preview.</p>}

      <section aria-labelledby={`${id}-1`} className="space-y-3">
        <h2 id={`${id}-1`} className="text-sm font-medium text-strong">1. Choose a type and a file</h2>
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-sm text-body">Type{" "}
            <select className={field} value={type} onChange={(e) => pickType(e.target.value as CsvType)}>
              {CSV_TYPES.map((t) => <option key={t.type} value={t.type}>{t.label}</option>)}
            </select>
          </label>
          <label className="text-sm text-body">File{" "}
            <input type="file" accept=".csv,text/csv" className="text-sm text-body file:mr-3 file:h-8 file:rounded-md file:border file:border-hairline file:bg-raised file:px-3 file:text-sm file:text-strong"
              onChange={(e) => e.target.files?.[0] && load(e.target.files[0])} />
          </label>
        </div>
        <p className="text-xs text-faint">Columns for {def.label.toLowerCase()}: {def.hint}.</p>
        {error && <p role="alert" className="text-sm text-conflict-ink">{error}</p>}
      </section>

      {headers.length > 0 && rows.length > 0 && (
        <>
          <section aria-labelledby={`${id}-2`} className="space-y-3">
            <h2 id={`${id}-2`} className="text-sm font-medium text-strong">2. Map columns</h2>
            <p className="text-xs text-faint">{file}: {rows.length} rows. Suggested from the headers; change any of them.</p>
            <ul className="grid gap-3 sm:grid-cols-2">
              {def.fields.map((f) => (
                <li key={f.key} className="flex items-center justify-between gap-3 rounded-card border border-hairline bg-surface p-3">
                  <label htmlFor={`${id}-${f.key}`} className="text-sm text-body">{f.label}{f.required && <span className="text-conflict-ink"> *</span>}</label>
                  <select id={`${id}-${f.key}`} className={`${field} min-w-0 max-w-[55%]`} value={mapping[f.key] ?? ""} onChange={(e) => setMapping({ ...mapping, [f.key]: e.target.value })}>
                    <option value="">Not mapped</option>
                    {headers.map((h) => <option key={h} value={h}>{h}</option>)}
                  </select>
                </li>
              ))}
            </ul>
            {missing.length > 0 && <p role="status" className="text-sm text-gap-ink">Map {missing.join(", ")} to continue.</p>}
          </section>

          <section aria-labelledby={`${id}-3`} className="space-y-3">
            <h2 id={`${id}-3`} className="text-sm font-medium text-strong">3. Preview the first 20 rows</h2>
            <div className="relative overflow-x-auto rounded-card border border-hairline bg-surface">
              <table className="w-full text-left text-sm">
                <thead><tr className="border-b border-hairline text-xs text-faint">
                  <th className="px-3 py-2 font-medium">Row</th>
                  {def.fields.map((f) => <th key={f.key} className="px-3 py-2 font-medium">{f.label}</th>)}
                  <th className="px-3 py-2 font-medium">Check</th>
                </tr></thead>
                <tbody className="divide-y divide-hairline">
                  {rows.slice(0, 20).map((r, i) => {
                    const p = problems.find((x) => x.row === i + 2);
                    return (
                      <tr key={i}>
                        <td className="px-3 py-1.5 text-faint">{i + 2}</td>
                        {def.fields.map((f) => <td key={f.key} className="max-w-48 truncate px-3 py-1.5 text-body">{mapping[f.key] ? r[mapping[f.key]] : ""}</td>)}
                        <td className={`whitespace-nowrap px-3 py-1.5 ${p ? "text-conflict-ink" : "text-covered-ink"}`}>{p ? p.message : "OK"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          <section aria-labelledby={`${id}-4`} className="space-y-3">
            <h2 id={`${id}-4`} className="text-sm font-medium text-strong">4. Import</h2>
            <button type="button" className={btn} disabled={busy || !canImport || missing.length > 0} onClick={run}>{busy ? "Importing..." : `Import ${rows.length} rows`}</button>
            {result && (
              <div role="status" className="space-y-2 text-sm text-body">
                <p>{result.applied} rows imported{result.errors.length ? `, ${result.errors.length} skipped.` : "."}</p>
                {result.errors.length > 0 && (
                  <ul className="space-y-1 text-conflict-ink">
                    {result.errors.slice(0, 50).map((e) => <li key={e.row}>Row {e.row}: {e.message}</li>)}
                    {result.errors.length > 50 && <li>and {result.errors.length - 50} more.</li>}
                  </ul>
                )}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
