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
    <div className="space-y-4 p-6">
      <div>
        <h1 className="text-lg font-medium text-strong">Import a CSV</h1>
        <p className="text-sm text-faint">Customers, deals, usage and who has access to which software. Re-importing the same file changes nothing.</p>
      </div>
      <Suspense><Importer /></Suspense>
    </div>
  );
}
