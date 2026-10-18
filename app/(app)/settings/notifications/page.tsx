import { connection } from "next/server";
import { Suspense } from "react";
import { PageHeader } from "@/components/shell/PageHeader";
import { PrefsSection } from "@/components/settings/sections";
import { PageLoading } from "@/components/states/States";
import { getContext } from "@/lib/server/context";

async function Prefs() {
  await connection(); // per-request: the viewer differs for every visit
  return <div className="max-w-3xl"><PrefsSection ctx={await getContext()} show="both" /></div>;
}

export default function NotificationsPage() {
  return (
    <>
      <PageHeader title="Notifications" subtitle="How you hear about changes, quiet hours and the weekly digest." crumbs={[{ label: "Settings", href: "/settings" }, { label: "Notifications" }]} />
      <Suspense fallback={<PageLoading />}><Prefs /></Suspense>
    </>
  );
}
