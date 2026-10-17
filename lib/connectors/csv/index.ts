// CSV upload connector: rows arrive from the browser (papaparse), map to structured proposals, and apply through the shared writer.
import { z } from "zod";
import type { Graph } from "../../graph/client";
import { applyProposal } from "../apply";
import { defineConnector } from "../define";
import { mapRow, type CsvRecord } from "./map";

export const csv = defineConnector({ kind: "csv", auth: "upload", map: (r) => mapRow(r as CsvRecord) });

export const MAX_ROWS = 1000;
export const ImportBody = z.object({
  type: z.enum(["customers", "deals", "usage", "access", "software"]),
  mapping: z.record(z.string(), z.string()),
  uploadId: z.string().regex(/^[\w-]{1,64}$/),
  /** Data-row index of rows[0] (0 = first row after the header), so chunked uploads report file rows. */
  offset: z.number().int().min(0).default(0),
  rows: z.array(z.record(z.string(), z.string())).min(1).max(MAX_ROWS),
});
export type ImportResult = { applied: number; errors: { row: number; message: string }[] };

/** A bad row is reported with its file row number (header = row 1) and writes nothing; the other rows still import. */
export async function importRows(g: Graph, body: z.output<typeof ImportBody>, now: number, orgId?: string): Promise<ImportResult> {
  const out: ImportResult = { applied: 0, errors: [] };
  for (const [i, row] of body.rows.entries()) {
    const rowNo = body.offset + i + 2;
    try {
      const proposals = csv.map({ ...body, row, rowNo }, { acct: undefined as never });
      for (const p of proposals) await applyProposal(g, p, now, orgId);
      out.applied++;
    } catch (e) {
      out.errors.push({ row: rowNo, message: e instanceof Error ? e.message : String(e) });
    }
  }
  return out;
}
