import { Suspense } from "react";
import { TopBar } from "@/components/ripple/TopBar";

// App shell: top bar, left slot for the decision sidebar (empty for now), then the screen.
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-[calc(100dvh-4.5rem)] min-h-[640px] flex-col bg-page">
      <Suspense fallback={<div className="h-12 border-b border-hairline" />}>
        <TopBar />
      </Suspense>
      <div className="flex min-h-0 flex-1">
        <aside data-slot="decision-sidebar" className="shrink-0 empty:hidden" />
        <main className="min-w-0 flex-1">
          <Suspense>{children}</Suspense>
        </main>
      </div>
    </div>
  );
}
