import { PageHeader } from "@/components/shell/PageHeader";
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
    <>
      <PageHeader title="Upload documents" subtitle="RFCs, policies and contracts as PDF, DOCX, Markdown or text. Contracts also become structured clauses." crumbs={[{ label: "Connections", href: "/connections" }, { label: "Upload documents" }]} />
      <Suspense fallback={<PageLoading />}><Uploader /></Suspense>
    </>
  );
}
