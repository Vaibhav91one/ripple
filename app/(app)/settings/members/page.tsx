import { connection } from "next/server";
import { Suspense } from "react";
import { PageHeader } from "@/components/shell/PageHeader";
import { MembersSection } from "@/components/settings/sections";
import { PageLoading } from "@/components/states/States";
import { getContext } from "@/lib/server/context";

async function Members() {
  await connection(); // per-request: the viewer differs for every visit
  return <MembersSection ctx={await getContext()} />;
}

export default function MembersPage() {
  return (
    <>
      <PageHeader title="Members" subtitle="Roles, teams and which person each account is." crumbs={[{ label: "Settings", href: "/settings" }, { label: "Members" }]} />
      <Suspense fallback={<PageLoading />}><Members /></Suspense>
    </>
  );
}
