import { z } from "zod";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { emit } from "@/lib/events/emit";
import { MAX_BYTES } from "@/lib/ingest/parse";
import { UPLOAD_TYPES, uploadFile } from "@/lib/ingest/upload";
import { getContext } from "@/lib/server/context";
import { denyIfReadonly } from "@/lib/server/route";

const Fields = z.object({
  type: z.enum(UPLOAD_TYPES),
  customerId: z.string().max(200).optional(),
  effective: z.iso.date().optional(),
  expires: z.iso.date().optional(),
});
const MAX_FILES = 20;

/** Upload documents or contracts (admins only). Each file is parsed, stored by sha256 (the original is not kept) and queued for ingestion. */
export async function POST(req: Request) {
  const ctx = await getContext(req);
  const denied = await denyIfReadonly(ctx, "connector.upload");
  if (denied) return denied;
  const v = ctx.viewer;
  if (v.kind !== "user" || v.role !== "admin") {
    await ctx.audit({ action: "connector.upload", resourceType: "connector", resourceId: "upload", outcome: "deny" });
    return Response.json({ error: "forbidden" }, { status: 403 });
  }
  if (Number(req.headers.get("content-length")) > MAX_BYTES * MAX_FILES) return Response.json({ error: "too_large", message: "That upload is too big." }, { status: 413 });
  const form = await req.formData().catch(() => null);
  const fields = Object.fromEntries([...(form?.entries() ?? [])].filter(([k, x]) => k !== "files" && typeof x === "string" && x !== ""));
  const f = Fields.safeParse(fields);
  const files = (form?.getAll("files") ?? []).filter((x): x is File => typeof x !== "string");
  if (!f.success || !files.length || files.length > MAX_FILES) return Response.json({ error: "bad_request", message: `Send 1-${MAX_FILES} files and a type.` }, { status: 400 });
  const results = [];
  for (const file of files) {
    results.push(file.size > MAX_BYTES
      ? { name: file.name, ok: false, error: `"${file.name}" is over the 20MB limit.` }
      : await uploadFile({ name: file.name, buf: Buffer.from(await file.arrayBuffer()) }, f.data.type, f.data, { org: ctx.org, writer: ctx.writer, now: ctx.now }));
  }
  // a new Contract node wakes the Contract Sentinel (worker route-event -> agent queue)
  if (env().DATABASE_URL)
    for (const r of results) if (r.ok && "contractId" in r && r.contractId) await emit(db(), { type: "contract.added", orgId: ctx.org.id, subject: { kind: "contract", id: r.contractId }, payload: { contractId: r.contractId }, dedupeKey: `contract.added:${r.contractId}` });
  await ctx.audit({ action: "connector.upload", resourceType: "connector", resourceId: "upload", meta: { type: f.data.type, files: files.length, ok: results.filter((r) => r.ok).length } });
  return Response.json({ results });
}
