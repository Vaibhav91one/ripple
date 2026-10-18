import { PageLoading } from "@/components/states/States";
import { Suspense } from "react";
import { LensArea } from "@/components/shell/LensArea";
import { AppShell } from "@/components/shell/AppShell";
import { AskDrawer } from "@/components/ask/AskDrawer";
import { SourcePanel } from "@/components/panels/SourcePanel";

// v2 shell around every app route (no sign-in UI). Overlays are URL-driven and live here so they work on every page.
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Suspense>
        <AppShell lensSlot={<Suspense><LensArea /></Suspense>}>
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
