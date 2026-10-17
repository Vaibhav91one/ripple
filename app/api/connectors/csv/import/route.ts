import { ImportBody, importRows } from "@/lib/connectors/csv";
import { getContext } from "@/lib/server/context";
import { denyIfReadonly } from "@/lib/server/route";

/** Import one chunk of mapped CSV rows (admins only). Re-sending a chunk is safe: every write merges on a natural key. */
export async function POST(req: Request) {
  const ctx = await getContext(req);
  const body = ImportBody.safeParse(await req.json().catch(() => null));
  if (!body.success) return Response.json({ error: "bad_request", message: body.error.message }, { status: 400 });
  const denied = await denyIfReadonly(ctx, "connector.csv_import");
  if (denied) return denied;
  const v = ctx.viewer;
  if (v.kind !== "user" || v.role !== "admin") {
    await ctx.audit({ action: "connector.csv_import", resourceType: "connector", resourceId: "csv", outcome: "deny" });
    return Response.json({ error: "forbidden" }, { status: 403 });
  }
  const res = await importRows(ctx.writer(), body.data, ctx.now, ctx.org.id);
  await ctx.audit({ action: "connector.csv_import", resourceType: "connector", resourceId: "csv", meta: { type: body.data.type, uploadId: body.data.uploadId, applied: res.applied, errors: res.errors.length } });
  return Response.json(res);
}
