import { PageLoading } from "@/components/states/States";
import { Suspense } from "react";
import { LensArea } from "@/components/shell/LensArea";
import { AppShell } from "@/components/shell/AppShell";
import { shellUser } from "@/components/shell/identity";
import { AuthArea } from "@/components/auth/AuthArea";
import { AskRedirect } from "@/components/assistant/AskRedirect";
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
      {/* URL-driven: ?src=<artifact> opens the source panel; the retired ?ask=1 drawer redirects to the Assistant at / */}
      <Suspense>
        <AskRedirect />
        <SourcePanel />
      </Suspense>
    </>
  );
}
