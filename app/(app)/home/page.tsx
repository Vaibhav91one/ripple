import { cookies } from "next/headers";
import { Suspense } from "react";
import { HomeScreen } from "@/components/home/HomeScreen";
import { LENS_COOKIE, parseLens } from "@/lib/lens";

/** The lens is part of the query key, so "view as" (router.refresh) re-reads Home for the new team. */
async function Lensed() {
  return <HomeScreen lens={parseLens((await cookies()).get(LENS_COOKIE)?.value)} />;
}

export default function HomePage() {
  return (
    <Suspense>
      <Lensed />
    </Suspense>
  );
}
