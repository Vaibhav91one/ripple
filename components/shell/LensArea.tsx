import { cookies } from "next/headers";
import { sessionViewer } from "@/lib/auth";
import { LENS_COOKIE, parseLens } from "@/lib/lens";
import { isLocalMode } from "./identity";
import { LensSwitcher } from "./LensSwitcher";

/** Sidebar slot, in <Suspense> (reads the request). Only the shared demo has a lens; a signed-in org gets nothing. */
export async function LensArea() {
  if (await sessionViewer()) return null;
  return <LensSwitcher current={parseLens((await cookies()).get(LENS_COOKIE)?.value)} local={isLocalMode()} />;
}
