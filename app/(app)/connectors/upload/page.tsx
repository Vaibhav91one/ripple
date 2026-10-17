import { PageLoading } from "@/components/states/States";
import { connection } from "next/server";
import { Suspense } from "react";
import { FileUpload } from "@/components/connectors/FileUpload";
import { roQuery } from "@/lib/graph/client";
import { getContext } from "@/lib/server/context";

async function Uploader() {
  await connection(); // per-request: the viewer differs for every visit
  const ctx = await getContext();
  const canUpload = !ctx.readonly && ctx.viewer.kind === "user" && ctx.viewer.role === "admin";
  const customers = await roQuery<{ id: string; name: string }>(ctx.graph, "MATCH (c:Customer) WHERE c.name IS NOT NULL RETURN c.id AS id, c.name AS name ORDER BY c.name LIMIT 500").catch(() => []);
  return <FileUpload canUpload={canUpload} customers={customers} />;
}

export default function UploadPage() {
  return (
    <div className="space-y-4 p-6">
      <div>
        <h1 className="text-lg font-medium text-strong">Upload documents</h1>
        <p className="text-sm text-faint">RFCs, policies and contracts as PDF, DOCX, Markdown or text. Contracts also become structured clauses.</p>
      </div>
      <Suspense fallback={<PageLoading />}><Uploader /></Suspense>
    </div>
  );
}
