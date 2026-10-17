import { Suspense } from "react";
import { AuthArea } from "@/components/auth/AuthArea";
import { LensArea } from "@/components/shell/LensArea";
import { AppShell } from "@/components/shell/AppShell";
import { AskDrawer } from "@/components/ask/AskDrawer";
import { SourcePanel } from "@/components/panels/SourcePanel";
import { ConflictDialog } from "@/components/ripple/ConflictDialog";

// Dashboard shell around every app route. Overlays are URL-driven and live here so they work on every page.
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-[calc(100dvh-4.5rem)] min-h-[640px] bg-page">
      <Suspense>
        <AppShell lensSlot={<Suspense><LensArea /></Suspense>} authSlot={<Suspense><AuthArea /></Suspense>}>
          <Suspense>{children}</Suspense>
        </AppShell>
      </Suspense>
      {/* Overlays driven by URL state: ?ask=1, ?src=<artifact>, ?conflict=open */}
      <Suspense>
        <AskDrawer />
        <SourcePanel />
        <ConflictDialog />
      </Suspense>
    </div>
  );
}
