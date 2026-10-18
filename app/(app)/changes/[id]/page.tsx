import { Suspense } from "react";
import { redirect } from "next/navigation";

// Old change links land on the case file (#233).
export default function ChangePage({ params }: PageProps<"/changes/[id]">) {
  return <Suspense><Go params={params} /></Suspense>;
}

async function Go({ params }: Pick<PageProps<"/changes/[id]">, "params">): Promise<never> {
  const { id } = await params;
  redirect(`/reports/${encodeURIComponent(id)}`);
}
