import { PageHeader } from "@/components/shell/PageHeader";
import { PageLoading } from "@/components/states/States";
import { connection } from "next/server";
import { Suspense } from "react";
import { CsvImport } from "@/components/connectors/CsvImport";
import { getContext } from "@/lib/server/context";

async function Importer() {
  await connection(); // per-request: the viewer differs for every visit
  const ctx = await getContext();
  const canImport = !ctx.readonly && ctx.viewer.kind === "user" && ctx.viewer.role === "admin";
  return <CsvImport canImport={canImport} />;
}

export default function CsvPage() {
  return (
    <>
      <PageHeader title="Import a CSV" subtitle="Customers, deals, usage and who has access to which software. Re-importing the same file changes nothing." crumbs={[{ label: "Connections", href: "/connections" }, { label: "Import a CSV" }]} />
      <Suspense fallback={<PageLoading />}><Importer /></Suspense>
    </>
  );
}
