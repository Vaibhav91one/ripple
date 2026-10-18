import { PageLoading } from "@/components/states/States";
import { Suspense } from "react";
import { LensArea } from "@/components/shell/LensArea";
import { AppShell } from "@/components/shell/AppShell";
import { shellUser } from "@/components/shell/identity";
import { AuthArea } from "@/components/auth/AuthArea";
import { AskDrawer } from "@/components/ask/AskDrawer";
import { SourcePanel } from "@/components/panels/SourcePanel";

// v2 shell around every app route (no sign-in UI in the demo; with Clerk keys the user card gets the Clerk org switch and user menu). Overlays are URL-driven and live here so they work on every page.
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Suspense>
        <AppShell user={shellUser()} lensSlot={<Suspense><LensArea /></Suspense>} authSlot={<Suspense><AuthArea /></Suspense>}>
          <Suspense fallback={<PageLoading />}>{children}</Suspense>
        </AppShell>
      </Suspense>
      {/* Overlays driven by URL state: ?ask=1, ?src=<artifact> */}
      <Suspense>
        <AskDrawer />
        <SourcePanel />
      </Suspense>
    </>
  );
}
